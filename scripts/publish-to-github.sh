#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/publish-to-github.sh [-m "commit message"]

Stages all repo changes, creates a commit if there are changes, and pushes the
current branch to origin.
EOF
}

message=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      shift
      [[ $# -gt 0 ]] || { echo "Missing value for --message" >&2; exit 1; }
      message="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "HEAD" ]]; then
  echo "Refusing to publish from a detached HEAD state." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  if [[ -z "$message" ]]; then
    message="Publish changes from ${branch} on $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  fi
  git commit -m "$message"
else
  echo "No changes to publish."
fi

git push -u origin "$branch"
