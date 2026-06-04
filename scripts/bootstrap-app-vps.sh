#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-website}"
PROJECT_ROOT="${PROJECT_ROOT:-/srv/$PROJECT_NAME/app}"
STATE_DIR="${STATE_DIR:-/etc/$PROJECT_NAME}"
BOOTSTRAP_ENV_FILE="${BOOTSTRAP_ENV_FILE:-$STATE_DIR/openbao-bootstrap.env}"
RUNTIME_ENV_FILE="${RUNTIME_ENV_FILE:-$STATE_DIR/runtime.env}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$STATE_DIR/deploy.env}"
BASE_ENV_FILE="${BASE_ENV_FILE:-$STATE_DIR/base.env}"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

write_secure_file() {
  local target="$1"
  umask 077
  cat >"$target"
  chmod 600 "$target"
}

prompt_for_bootstrap_env() {
  local bao_addr role_id secret_id

  echo "OpenBao AppRole bootstrap credentials are required."
  read -r -p "BAO_ADDR: " bao_addr
  read -r -p "OPENBAO_ROLE_ID: " role_id
  read -r -s -p "OPENBAO_SECRET_ID: " secret_id
  echo

  write_secure_file "$BOOTSTRAP_ENV_FILE" <<EOF
BAO_ADDR=$bao_addr
OPENBAO_ROLE_ID=$role_id
OPENBAO_SECRET_ID=$secret_id
EOF

  echo "Saved bootstrap credentials to $BOOTSTRAP_ENV_FILE"
}

load_bootstrap_env() {
  if [[ ! -f "$BOOTSTRAP_ENV_FILE" ]]; then
    if [[ -t 0 ]]; then
      prompt_for_bootstrap_env
    else
      echo "Missing $BOOTSTRAP_ENV_FILE. Re-run interactively or create it manually." >&2
      exit 1
    fi
  fi

  # shellcheck disable=SC1090
  source "$BOOTSTRAP_ENV_FILE"

  : "${BAO_ADDR:?Missing BAO_ADDR in $BOOTSTRAP_ENV_FILE}"
  : "${OPENBAO_ROLE_ID:?Missing OPENBAO_ROLE_ID in $BOOTSTRAP_ENV_FILE}"
  : "${OPENBAO_SECRET_ID:?Missing OPENBAO_SECRET_ID in $BOOTSTRAP_ENV_FILE}"
}

wait_for_valid_bootstrap() {
  while true; do
    load_bootstrap_env

    if env \
      BAO_ADDR="$BAO_ADDR" \
      OPENBAO_ROLE_ID="$OPENBAO_ROLE_ID" \
      OPENBAO_SECRET_ID="$OPENBAO_SECRET_ID" \
      node scripts/fetch-openbao-secrets.mjs; then
      break
    fi

    echo "OpenBao bootstrap credentials were rejected or secret fetch failed."

    if [[ -t 0 ]]; then
      rm -f "$BOOTSTRAP_ENV_FILE"
      prompt_for_bootstrap_env
      continue
    fi

    echo "Waiting for corrected credentials at $BOOTSTRAP_ENV_FILE ..."
    sleep 15
  done
}

prepare_deploy_env() {
  if [[ ! -f "$BASE_ENV_FILE" ]]; then
    echo "Missing $BASE_ENV_FILE. Create it from deploy/app-vps.base.env.example before bootstrap." >&2
    exit 1
  fi

  node scripts/prepare-full-stack-env.mjs \
    --mode prod \
    --base "$BASE_ENV_FILE" \
    --runtime .env.runtime \
    --output "$DEPLOY_ENV_FILE"

  cp .env.runtime "$RUNTIME_ENV_FILE"
  chmod 600 "$RUNTIME_ENV_FILE" "$DEPLOY_ENV_FILE"
}

main() {
  require_command node
  require_command docker

  cd "$PROJECT_ROOT"
  wait_for_valid_bootstrap
  prepare_deploy_env

  echo "Bootstrap complete."
  echo "Runtime env: $RUNTIME_ENV_FILE"
  echo "Deploy env:  $DEPLOY_ENV_FILE"
}

main "$@"
