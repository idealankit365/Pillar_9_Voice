#!/usr/bin/env bash
# Starts the voice service against the current ngrok tunnel.
# ngrok's free URL changes on every restart, and that URL is baked into the Retell
# agent's tool + webhook endpoints, so this re-bootstraps the agent whenever it moves.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

say "1/4  Looking for the ngrok tunnel"
TUNNEL=$(curl -sf http://127.0.0.1:4040/api/tunnels 2>/dev/null \
  | python3 -c "import json,sys;print(next((t['public_url'] for t in json.load(sys.stdin).get('tunnels',[]) if t['proto']=='https'),''))" 2>/dev/null || true)
if [ -z "$TUNNEL" ]; then
  echo "  No ngrok tunnel found."
  echo "  Open another terminal and run:  ngrok http 8787"
  exit 1
fi
echo "  $TUNNEL"

CURRENT=$(grep '^PUBLIC_BASE_URL=' .env | cut -d= -f2-)
say "2/4  Checking the Retell agent's URL"
if [ "$CURRENT" = "$TUNNEL" ]; then
  echo "  Unchanged; agent already points here."
else
  echo "  Changed: $CURRENT -> $TUNNEL"
  # macOS and GNU sed take different -i arguments.
  sed -i '' "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=$TUNNEL|" .env 2>/dev/null \
    || sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=$TUNNEL|" .env
  echo "  Re-pointing the agent's 13 tool URLs and webhook..."
  node scripts/bootstrap-retell.js --apply | python3 -c "import json,sys;d=json.load(sys.stdin);print('  agent',d['agentId'],'updated')"
fi

say "3/4  Current mode"
DRY=$(grep '^RETELL_DRY_RUN=' .env | cut -d= -f2-)
if [ "$DRY" = "false" ]; then
  echo "  LIVE — calls are real and billable."
else
  echo "  DRY RUN — no call will be placed."
  echo "  To call for real, set RETELL_DRY_RUN=false and DEMO_PANEL_ALLOW_LIVE_CALLS=true in .env, then rerun."
fi

say "4/4  Starting the server"
echo "  Panel: http://127.0.0.1:8787/demo    (Ctrl+C to stop)"
exec node src/server.js
