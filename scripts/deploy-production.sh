#!/usr/bin/env bash
# Deploys the Pillar 9 voice service on a shared company server.
# Scoped to this project only: it never touches other Compose stacks, other Nginx sites
# or system-wide Docker resources.
set -Eeuo pipefail

readonly SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEPLOY_ROOT="${APP_DEPLOY_DIR:-/var/www/pillar9-voice}"
readonly ENV_FILE="${APP_ENV_FILE:-/etc/pillar9-voice/voice.env}"
readonly DEPLOY_REVISION="${DEPLOY_REVISION:-unknown}"
readonly COMPOSE_PROJECT="pillar9-voice"

# Refuse to write anywhere but a dedicated directory.
if [[ "${DEPLOY_ROOT}" != /var/www/* || "${DEPLOY_ROOT}" == "/var/www/" ]]; then
  echo "Deployment directory must be a dedicated directory below /var/www." >&2; exit 1
fi
[[ -f "${ENV_FILE}" ]] || { echo "Production env file not found: ${ENV_FILE}" >&2; exit 1; }

for required in curl docker flock rsync; do
  command -v "${required}" >/dev/null 2>&1 || { echo "Missing command: ${required}" >&2; exit 1; }
done

# Placeholders must never reach a live phone system.
if grep -Eq '=(replace-with-|<[^>]+>|change_this)' "${ENV_FILE}"; then
  echo "Env file still contains placeholder values." >&2; exit 1
fi

# The app refuses to boot with NODE_ENV=production unless every external adapter
# (Matrix, compliance/DNCL, messaging) is a real HTTPS service. Fail early and clearly.
if grep -Eq '^NODE_ENV=production' "${ENV_FILE}"; then
  if ! grep -Eq '^MATRIX_MODE=http' "${ENV_FILE}" || ! grep -Eq '^COMPLIANCE_MODE=http' "${ENV_FILE}"; then
    echo "NODE_ENV=production requires real MATRIX_MODE=http and COMPLIANCE_MODE=http adapters." >&2
    echo "Keep NODE_ENV=development until those exist." >&2; exit 1
  fi
fi

bind_port="$(sed -n 's/^APP_BIND_PORT=//p' "${ENV_FILE}" | tail -n 1 | tr -d '[:space:]')"
bind_port="${bind_port:-8787}"
[[ "${bind_port}" =~ ^[0-9]+$ ]] || { echo "APP_BIND_PORT must be numeric." >&2; exit 1; }

mkdir -p "${DEPLOY_ROOT}"
exec 9>"${DEPLOY_ROOT}/.deploy.lock"
flock -n 9 || { echo "Another deployment of this project is already running." >&2; exit 1; }

rsync --archive --delete \
  --exclude '.deploy.lock' --exclude '.env' --exclude '.git/' \
  --exclude 'node_modules/' --exclude 'web/node_modules/' --exclude 'data/' \
  "${SOURCE_ROOT}/" "${DEPLOY_ROOT}/"

cd "${DEPLOY_ROOT}"
ln -sfn "${ENV_FILE}" .env

# -p pins the project so this only ever rebuilds this stack. No --profile tunnel,
# so the ngrok sidecar never starts on the server.
docker compose -p "${COMPOSE_PROJECT}" --env-file "${ENV_FILE}" config --quiet
docker compose -p "${COMPOSE_PROJECT}" --env-file "${ENV_FILE}" up --build --detach --remove-orphans voice-api

for _ in {1..60}; do
  if curl --fail --silent "http://127.0.0.1:${bind_port}/health" >/dev/null; then
    printf '%s\n' "${DEPLOY_REVISION}" > .deployed-revision
    echo "Deployed revision ${DEPLOY_REVISION} and healthy on 127.0.0.1:${bind_port}."
    exit 0
  fi
  sleep 5
done

docker compose -p "${COMPOSE_PROJECT}" --env-file "${ENV_FILE}" ps
docker compose -p "${COMPOSE_PROJECT}" --env-file "${ENV_FILE}" logs --no-color --tail=200 voice-api
echo "Service did not become healthy." >&2
exit 1
