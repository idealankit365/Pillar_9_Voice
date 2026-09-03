#!/bin/sh
# One-command startup. Everything `npm run demo` used to do by hand, in order:
#   1. discover the public tunnel URL (if the ngrok sidecar is running)
#   2. seed the database and load the 5,000 Calgary properties on first boot only
#   3. re-point the Retell agent at the current public URL
#   4. start the service
# Each step degrades gracefully so the container still boots without Retell or ngrok.
set -e

log() { echo "[start] $*"; }

# ---- 1. public URL ---------------------------------------------------------
if [ -n "${NGROK_API:-}" ] && [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  log "waiting for the ngrok sidecar at ${NGROK_API} ..."
  i=0
  while [ "$i" -lt 40 ]; do
    URL=$(node -e "
      fetch('http://${NGROK_API}/api/tunnels')
        .then(r => r.json())
        .then(d => { const t = (d.tunnels || []).find(x => x.proto === 'https'); process.stdout.write(t ? t.public_url : ''); })
        .catch(() => process.stdout.write(''));
    " 2>/dev/null || true)
    [ -n "$URL" ] && break
    i=$((i + 1)); sleep 1
  done
  if [ -n "$URL" ]; then
    export PUBLIC_BASE_URL="$URL"
    log "public URL: $PUBLIC_BASE_URL"
  else
    log "WARNING: no tunnel found; falling back to PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-unset}"
  fi
else
  log "no ngrok token — using PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-unset}"
fi

# ---- 2. first-boot data ----------------------------------------------------
# The data volume persists, so this runs once and is skipped on every later start.
COUNT=$(node -e "
  import('./src/db.js').then(({ Repository }) => {
    const repo = new Repository(process.env.DATABASE_PATH || '/app/data/pillar9-voice.sqlite');
    process.stdout.write(String(repo.countListings()));
    repo.close();
  }).catch(() => process.stdout.write('0'));
" 2>/dev/null || echo 0)

if [ "$COUNT" -lt 100 ]; then
  log "empty database (${COUNT} listings) — seeding and loading the Calgary fixture"
  node scripts/seed.js >/dev/null 2>&1 || log "WARNING: seed failed"
  node scripts/load-calgary-into-db.js >/dev/null 2>&1 && log "loaded 5,000 synthetic properties" \
    || log "WARNING: Calgary load failed"
else
  log "database already holds ${COUNT} listings — skipping seed"
fi

# ---- 3. Retell agent -------------------------------------------------------
# Only update an EXISTING agent. Without RETELL_AGENT_ID a bootstrap would create a
# brand-new agent on every container start, quietly littering the Retell account.
if [ -n "${RETELL_API_KEY:-}" ] && [ -n "${RETELL_AGENT_ID:-}" ]; then
  log "re-pointing agent ${RETELL_AGENT_ID} at ${PUBLIC_BASE_URL}"
  node scripts/bootstrap-retell.js --apply >/dev/null 2>&1 && log "agent updated" \
    || log "WARNING: agent update failed — tool calls and webhooks may not reach this host"
elif [ -n "${RETELL_API_KEY:-}" ]; then
  log "RETELL_AGENT_ID is unset — skipping bootstrap so no duplicate agent is created."
  log "Run 'npm run bootstrap:retell:apply' once, then put the printed IDs in .env."
else
  log "no RETELL_API_KEY — starting in local/dry-run mode"
fi

# ---- 4. serve --------------------------------------------------------------
log "starting the voice service on :${PORT:-8787}"
exec node src/server.js
