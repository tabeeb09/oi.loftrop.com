#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-website}"
PROJECT_ROOT="${PROJECT_ROOT:-/srv/$PROJECT_NAME/app}"
STATE_DIR="${STATE_DIR:-/etc/$PROJECT_NAME}"
BASE_ENV_FILE="${BASE_ENV_FILE:-$STATE_DIR/base.env}"
REPO_URL="${REPO_URL:-https://github.com/tabeeb09/oi.loftrop.com.git}"
REPO_REF="${REPO_REF:-main}"

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "Run as root, for example: sudo bash scripts/setup-rustfs-vps.sh" >&2
    exit 1
  fi
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo apt
  elif command -v dnf >/dev/null 2>&1; then
    echo dnf
  elif command -v yum >/dev/null 2>&1; then
    echo yum
  else
    echo "Unsupported package manager. Install git and curl manually, then rerun." >&2
    exit 1
  fi
}

install_bootstrap_dependencies() {
  if command -v git >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    return
  fi

  case "$(detect_pkg_manager)" in
    apt)
      apt-get update
      apt-get install -y ca-certificates curl git
      ;;
    dnf)
      dnf install -y ca-certificates curl git
      ;;
    yum)
      yum install -y ca-certificates curl git
      ;;
  esac
}

checkout_repo() {
  mkdir -p "$(dirname "$PROJECT_ROOT")"

  if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
    git clone --branch "$REPO_REF" "$REPO_URL" "$PROJECT_ROOT"
  else
    git -C "$PROJECT_ROOT" fetch --all --tags
    git -C "$PROJECT_ROOT" checkout "$REPO_REF"
    git -C "$PROJECT_ROOT" pull --ff-only origin "$REPO_REF"
  fi
}

prompt_if_placeholder() {
  local key="$1"
  local prompt="$2"
  local default="$3"
  local current value
  current="$(grep -E "^$key=" "$BASE_ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"

  if [[ -n "$current" && "$current" != *example.com* && "$current" != "https://openbao.internal.example.com" ]]; then
    return
  fi

  read -r -p "$prompt [$default]: " value
  value="${value:-$default}"

  if grep -qE "^$key=" "$BASE_ENV_FILE"; then
    sed -i "s|^$key=.*|$key=$value|" "$BASE_ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$BASE_ENV_FILE"
  fi
}

configure_base_env() {
  if [[ ! -f "$BASE_ENV_FILE" ]]; then
    echo "Missing $BASE_ENV_FILE after provisioning." >&2
    exit 1
  fi

  echo "Configuring RustFS/media deployment values in $BASE_ENV_FILE"
  prompt_if_placeholder MEDIA_HOST "Public media host" "media.example.com"
  prompt_if_placeholder RUSTFS_ADMIN_HOST "RustFS admin host" "rustfs-admin.example.com"
  prompt_if_placeholder OAUTH2_PROXY_HOST "OAuth2 proxy host for RustFS admin" "oauth2.example.com"
  prompt_if_placeholder NEXT_PUBLIC_MEDIA_BASE_URL "Media public URL" "https://media.example.com"
  prompt_if_placeholder S3_PUBLIC_ENDPOINT "S3 public/media endpoint" "https://media.example.com"
  prompt_if_placeholder KEYCLOAK_ISSUER "Keycloak issuer URL" "https://auth.example.com/realms/website"
  prompt_if_placeholder BAO_ADDR "OpenBao URL reachable from this RustFS VPS" "https://bao.example.com"
  prompt_if_placeholder OAUTH2_PROXY_REDIRECT_URL "OAuth2 Proxy redirect URL" "https://oauth2.example.com/oauth2/callback"

  if ! grep -qE '^RUSTFS_NETWORK=' "$BASE_ENV_FILE"; then
    printf '%s\n' 'RUSTFS_NETWORK=rustfs_internal' >>"$BASE_ENV_FILE"
  fi

  if ! grep -qE '^RUSTFS_HTTP_PORT=' "$BASE_ENV_FILE"; then
    printf '%s\n' 'RUSTFS_HTTP_PORT=8082' >>"$BASE_ENV_FILE"
  fi

  if ! grep -qE '^RUSTFS_HTTPS_PORT=' "$BASE_ENV_FILE"; then
    printf '%s\n' 'RUSTFS_HTTPS_PORT=9443' >>"$BASE_ENV_FILE"
  fi
}

main() {
  require_root
  install_bootstrap_dependencies
  checkout_repo

  REPO_URL="$REPO_URL" REPO_REF="$REPO_REF" PROJECT_NAME="$PROJECT_NAME" PROJECT_ROOT="$PROJECT_ROOT" STATE_DIR="$STATE_DIR" bash "$PROJECT_ROOT/scripts/provision-app-vps.sh"

  configure_base_env

  cd "$PROJECT_ROOT"
  PROJECT_ROOT="$PROJECT_ROOT" PROJECT_NAME="$PROJECT_NAME" bash ./scripts/bootstrap-app-vps.sh
  PROJECT_ROOT="$PROJECT_ROOT" PROJECT_NAME="$PROJECT_NAME" bash ./scripts/deploy-rustfs-vps.sh
}

main "$@"
