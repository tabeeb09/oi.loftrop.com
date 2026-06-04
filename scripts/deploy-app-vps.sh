#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-website}"
PROJECT_ROOT="${PROJECT_ROOT:-/srv/$PROJECT_NAME/app}"
STATE_DIR="${STATE_DIR:-/etc/$PROJECT_NAME}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$STATE_DIR/deploy.env}"

cd "$PROJECT_ROOT"

if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
  echo "Missing $DEPLOY_ENV_FILE. Run scripts/bootstrap-app-vps.sh first." >&2
  exit 1
fi

docker compose -f docker-compose.full.yaml --env-file "$DEPLOY_ENV_FILE" pull
docker compose -f docker-compose.full.yaml --env-file "$DEPLOY_ENV_FILE" up -d
