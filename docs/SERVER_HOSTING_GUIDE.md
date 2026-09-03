# Hosting the Pillar 9 Voice Agent on the company server

**Project:** Pillar 9 Voice Representative
**Pattern:** same GitHub Actions + self-hosted runner approach as Precise TBM
**Prepared:** 3 September 2026

Replace every `<PLACEHOLDER>` on the server. Never paste real secrets into GitHub, commits or chat.

> **This server already runs other services.** Everything below is namespaced to this
> project — its own runner label, deploy directory, env file, Compose project name,
> Nginx site and loopback port. Nothing here restarts, rebuilds or removes another
> stack. The commands to avoid are listed in §11.

---

## 1. What gets deployed

One container. The service is Node 24 with **zero runtime npm dependencies**; SQLite is a
file on a Docker volume. There is no database server, queue or cache to run.

| Item | Value |
| --- | --- |
| GitHub repository | `idealankit365/Pillar_9_Voice` |
| Production branch | `main` |
| CI workflow name | `Voice Agent CI` |
| Runner label | `pillar9-voice-production` |
| Deploy directory | `/var/www/pillar9-voice` |
| Protected env file | `/etc/pillar9-voice/voice.env` |
| Compose project name | `pillar9-voice` |
| Container port | `8787` |
| Host bind | `127.0.0.1:<APP_BIND_PORT>` (loopback only) |
| Health endpoint | `/health` |
| Public domain | `<API_DOMAIN>` |
| Persistent volume | `pillar9-voice_voice-data` (SQLite: consents, DNC, call history) |

### Why this must be internet-facing

Retell calls **your server** during a live phone call: thirteen tool endpoints under
`/tools/*` plus the `/webhooks/retell` callback. If the domain is unreachable, calls still
connect but the agent cannot look up listings or record outcomes. This replaces the ngrok
tunnel used in development.

---

## 2. Two things specific to this project

**a) Keep `NODE_ENV=development`.**
The app deliberately refuses to boot with `NODE_ENV=production` unless every external
adapter is a real HTTPS service — Matrix listings, the compliance/DNCL decision service and
the messaging provider. Those do not exist yet; the project runs on fixtures. Setting
production will fail the deploy with `CONFIG_MATRIX_FIXTURE_FORBIDDEN` or similar. The
deploy script checks this and stops early with a clear message.

This does **not** disable the safety controls — consent, do-not-contact, calling windows
and automation disclosure run in every environment.

**b) Live calls cost money.** `RETELL_DRY_RUN=false` means every dispatch is billable
(~$0.27/min to India, ~$0.13/min domestic Canadian). Deploy with `RETELL_DRY_RUN=true`
first, confirm the panel works, then flip it deliberately.

---

## 3. Pick a free port

`8787` may already be taken on this server. Check before you choose:

```bash
sudo ss -ltnp | grep -E ':(8787|8788|8789)\b' || echo "8787, 8788 and 8789 are all free"
```

Use the first free one as `APP_BIND_PORT`. It binds to `127.0.0.1` only, so it is never
reachable from the internet — Nginx is the only way in.

---

## 4. Prepare the server (one time)

You already have Docker, Nginx, `rsync` and a runner account from the Precise TBM setup.
**Do not reinstall them.** Only create this project's own directories.

```bash
export RUNNER_USER="github-runner"          # the existing account
export DEPLOY_DIR="/var/www/pillar9-voice"
export CONFIG_DIR="/etc/pillar9-voice"

sudo install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0750 "$DEPLOY_DIR"
sudo install -d -o root -g "$RUNNER_USER" -m 0750 "$CONFIG_DIR"
sudo touch "$CONFIG_DIR/voice.env"
sudo chown root:"$RUNNER_USER" "$CONFIG_DIR/voice.env"
sudo chmod 0640 "$CONFIG_DIR/voice.env"
sudo ls -ld "$DEPLOY_DIR" "$CONFIG_DIR"
```

---

## 5. Write the production env file

```bash
sudoedit /etc/pillar9-voice/voice.env
```

Generate the three service keys **on the server** — do not reuse your laptop's:

```bash
openssl rand -hex 24    # run three times
```

```dotenv
# ---- runtime ----
NODE_ENV=development
HOST=0.0.0.0
PORT=8787
APP_BIND_PORT=8787
PUBLIC_BASE_URL=https://<API_DOMAIN>
DATABASE_PATH=/app/data/pillar9-voice.sqlite
AUTO_SEED=true
LOG_LEVEL=info

# ---- service keys (generated above, all different) ----
ADMIN_API_KEY=<48_HEX_CHARS>
TOOL_API_KEY=<48_HEX_CHARS>
DEMO_PANEL_API_KEY=<48_HEX_CHARS>

# ---- demo console ----
DEMO_PANEL_ENABLED=true
DEMO_PANEL_ALLOW_LIVE_CALLS=false     # true only when you intend billable calls

# ---- Retell ----
VOICE_PROVIDER=retell
RETELL_API_KEY=<YOUR_RETELL_KEY>
RETELL_WEBHOOK_KEY=                   # blank = same key; set if a different key is badged "Webhook Key"
RETELL_DRY_RUN=true                   # flip to false after the first successful deploy
RETELL_AGENT_ID=<agent_...>
RETELL_LLM_ID=<llm_...>
RETELL_VOICE_ID=<custom_voice_...>
RETELL_VOICE_SPEED=1.15
RETELL_LLM_MODEL=gpt-4.1-mini
RETELL_FROM_NUMBER=+1<YOUR_RETELL_NUMBER>
RETELL_INBOUND_NUMBER=+1<YOUR_RETELL_NUMBER>

# ---- identity shown to every caller ----
SERVICE_NAME=Pillar 9
ASSISTANT_NAME=Ava
LICENSED_AGENT_NAME=<REAL_LICENSED_NAME>
LICENSED_AGENT_LICENSE_NUMBER=<RECA_NUMBER>
BROKERAGE_NAME=<REAL_BROKERAGE>
TRANSFER_PHONE_NUMBER=+1<HUMAN_HANDOFF>
MORTGAGE_TRANSFER_PHONE_NUMBER=+1<MORTGAGE_HANDOFF>
DEFAULT_TIMEZONE=America/Edmonton

# ---- fixtures (no real adapters yet) ----
MATRIX_MODE=fixture
COMPLIANCE_MODE=fixture
MESSAGING_MODE=log
APPROVED_LISTING_HOSTS=<listings.your-domain.ca>

# ---- calling window: CRTC limits, do not widen for real contacts ----
CALL_WINDOW_START=09:00
CALL_WINDOW_END=20:00
WEEKEND_CALL_WINDOW_START=10:00
WEEKEND_CALL_WINDOW_END=18:00
MAX_CALL_DURATION_MINUTES=12
CONSENT_MAX_AGE_DAYS=365

# ---- not used on the server ----
NGROK_AUTHTOKEN=
```

Then:

```bash
sudo chown root:github-runner /etc/pillar9-voice/voice.env
sudo chmod 0640 /etc/pillar9-voice/voice.env
sudo -u github-runner test -r /etc/pillar9-voice/voice.env && echo "runner can read it"
```

---

## 6. Register a runner for this repository

Runners are **per repository**, so the Precise TBM runner cannot serve this one. Register a
second runner in its own directory. In GitHub: **Settings → Actions → Runners → New
self-hosted runner → Linux → x64**, then use the commands GitHub shows:

```bash
export RUNNER_DIR="/opt/actions-runner-pillar9-voice"
sudo install -d -o github-runner -g github-runner -m 0750 "$RUNNER_DIR"
sudo -iu github-runner
cd /opt/actions-runner-pillar9-voice
# ... GitHub's curl + sha256sum -c + tar commands here ...

./config.sh \
  --url "https://github.com/idealankit365/Pillar_9_Voice" \
  --token "<SHORT_LIVED_TOKEN_FROM_GITHUB>" \
  --name "pillar9-voice-production-01" \
  --labels "pillar9-voice-production" \
  --work "_work" --unattended --replace
exit
```

Install it as its own service — this does not affect the existing runner:

```bash
cd /opt/actions-runner-pillar9-voice
sudo ./svc.sh install github-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

GitHub should show it **Idle** with `self-hosted, linux, x64, pillar9-voice-production`.

---

## 7. Nginx site for this domain only

Create a new site file. **Do not edit any existing site.**

```bash
sudoedit /etc/nginx/sites-available/pillar9-voice
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name <API_DOMAIN>;

    # Retell posts webhooks and calls the thirteen tool endpoints from its own
    # infrastructure, so this must stay publicly reachable.
    location / {
        proxy_pass http://127.0.0.1:<APP_BIND_PORT>;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -sfn /etc/nginx/sites-available/pillar9-voice /etc/nginx/sites-enabled/pillar9-voice
sudo nginx -t          # must pass before reloading
sudo systemctl reload nginx
```

`nginx -t` validates **all** sites; if it fails, check the error names this file before
reloading, so other sites are never disturbed.

### DNS and TLS

```bash
dig +short <API_DOMAIN>          # must return the server's public IP
sudo certbot --nginx -d <API_DOMAIN>
curl --fail https://<API_DOMAIN>/health
```

---

## 8. First deployment

Push the pipeline from your laptop:

```bash
git add -A
git status                       # confirm .env is NOT listed
git commit -m "ci: production deployment for the company server"
git push origin main
```

In GitHub **Actions**: `Voice Agent CI` runs first (tests, React build, image build, health
check). Only on success does `Deploy production` start and pick the
`pillar9-voice-production` runner.

The deploy script rsyncs the tested commit, links the protected env file, validates Compose,
builds, starts **only** `voice-api`, then polls `/health` for up to five minutes.

On first boot the container seeds the database and loads all 5,000 Calgary properties
automatically. That happens once; the volume persists afterwards.

---

## 9. Point Retell at the domain

The agent's tool URLs and webhook are baked in at bootstrap and still point at ngrok. Update
them once:

```bash
cd /var/www/pillar9-voice
sudo -u github-runner docker compose -p pillar9-voice --env-file /etc/pillar9-voice/voice.env \
  exec -T voice-api node scripts/bootstrap-retell.js --apply
```

Verify in the Retell dashboard that the agent's webhook is now
`https://<API_DOMAIN>/webhooks/retell`.

> The container's entrypoint re-runs this on every start when `RETELL_AGENT_ID` is set, so
> after the first time it stays in sync by itself.

---

## 10. Verify

```bash
export ENV_FILE=/etc/pillar9-voice/voice.env
cd /var/www/pillar9-voice

sudo -u github-runner cat .deployed-revision            # deployed commit SHA
docker compose -p pillar9-voice --env-file "$ENV_FILE" ps
curl --fail http://127.0.0.1:<APP_BIND_PORT>/health
curl --fail https://<API_DOMAIN>/health

# a tool endpoint must reject an unauthenticated request
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<API_DOMAIN>/tools/context   # expect 401

# the demo console
open https://<API_DOMAIN>/demo    # log in with DEMO_PANEL_API_KEY
```

Confirm the console shows **Properties 5006** and **Provider retell**.

---

## 11. Commands that would affect other services — never run these

```text
docker system prune -a --volumes     # deletes other projects' images and DATA
docker compose down --volumes        # deletes THIS project's consents and DNC records
docker stop $(docker ps -q)          # stops every container on the server
sudo systemctl restart docker        # restarts every container on the server
sudo rm /etc/nginx/sites-enabled/*   # disables every site
```

Always scope Compose commands with `-p pillar9-voice` and run them from
`/var/www/pillar9-voice`. To restart only this project:

```bash
cd /var/www/pillar9-voice
docker compose -p pillar9-voice --env-file /etc/pillar9-voice/voice.env restart voice-api
```

---

## 12. Going live with real calls

Only after the health checks pass and you have placed a successful dry-run preview:

```bash
sudoedit /etc/pillar9-voice/voice.env
#   RETELL_DRY_RUN=false
#   DEMO_PANEL_ALLOW_LIVE_CALLS=true

cd /var/www/pillar9-voice
docker compose -p pillar9-voice --env-file /etc/pillar9-voice/voice.env up -d voice-api
```

Every button press in the console is now a billable call.

---

## 13. Rollback

Same as Precise TBM — revert through Git so the rollback is also CI-tested:

```bash
git log --oneline -20
git revert <BAD_COMMIT_SHA>
git push origin main
```

Never force-push shared history. Never roll back by deleting the Docker volume: it holds
consent evidence and do-not-contact records, which are compliance data.

---

## 14. Backups

The volume `pillar9-voice_voice-data` holds the only copy of consents, DNC entries and call
history. SQLite backs up safely with its own tooling:

```bash
sudo -u github-runner docker compose -p pillar9-voice \
  --env-file /etc/pillar9-voice/voice.env exec -T voice-api \
  node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync(process.env.DATABASE_PATH).exec(\"VACUUM INTO '/app/data/backup.sqlite'\")"

sudo docker cp pillar9-voice-voice-api-1:/app/data/backup.sqlite \
  /var/backups/pillar9-voice-$(date +%F).sqlite
```

Copy those off the server, set a retention policy, and test a restore once.

Everything else — the 5,000 properties, the fixture database, the React build — is
regenerated from the repository, so it needs no backup.

---

## 15. Go-live checklist

- [ ] A free loopback port chosen and set as `APP_BIND_PORT`
- [ ] `/etc/pillar9-voice/voice.env` exists, mode `0640`, no placeholders
- [ ] `NODE_ENV=development` (production would refuse to boot on fixtures)
- [ ] Three different randomly generated service keys
- [ ] Real licensed name, licence number and brokerage set
- [ ] Runner online with label `pillar9-voice-production`
- [ ] `nginx -t` passes and only the new site was added
- [ ] HTTPS certificate issued for `<API_DOMAIN>`
- [ ] `https://<API_DOMAIN>/health` returns 200
- [ ] `/tools/context` returns 401 without a key
- [ ] Retell agent webhook points at the domain, not ngrok
- [ ] Console shows 5,006 properties
- [ ] A dry-run preview succeeds before `RETELL_DRY_RUN=false`
- [ ] Calling window left at CRTC limits
- [ ] A database backup has been taken and restored once
- [ ] No other service on the server was restarted or modified
