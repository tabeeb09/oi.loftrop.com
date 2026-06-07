#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-website}"
PROJECT_ROOT="${PROJECT_ROOT:-/srv/$PROJECT_NAME/app}"
STATE_DIR="${STATE_DIR:-/etc/$PROJECT_NAME}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$STATE_DIR/deploy.env}"
APP_COMPOSE_PROJECT="${APP_COMPOSE_PROJECT:-app}"
RUSTFS_NETWORK="${RUSTFS_NETWORK:-rustfs_internal}"

cd "$PROJECT_ROOT"

if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
  echo "Missing $DEPLOY_ENV_FILE. Run scripts/bootstrap-app-vps.sh first." >&2
  exit 1
fi

if ! docker network inspect "$RUSTFS_NETWORK" >/dev/null 2>&1; then
  echo "Missing Docker network '$RUSTFS_NETWORK'." >&2
  echo "Start RustFS first with scripts/deploy-rustfs-vps.sh, or set RUSTFS_NETWORK to the existing media network." >&2
  exit 1
fi

docker compose -p "$APP_COMPOSE_PROJECT" -f docker-compose.full.yaml --env-file "$DEPLOY_ENV_FILE" pull
docker compose -p "$APP_COMPOSE_PROJECT" -f docker-compose.full.yaml --env-file "$DEPLOY_ENV_FILE" up -d
