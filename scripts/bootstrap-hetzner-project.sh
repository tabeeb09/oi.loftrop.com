#!/usr/bin/env sh
set -eu

IMAGE_NAME="${IMAGE_NAME:-oi-loftrop/bootstrap-tools:local}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

docker build \
  -f "$REPO_ROOT/infra/bootstrap-tools.Dockerfile" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

docker run --rm -it \
  -v "$REPO_ROOT:/work" \
  -w /work \
  "$IMAGE_NAME" \
  "$@"
