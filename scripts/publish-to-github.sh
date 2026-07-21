#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/publish-to-github.sh [options] [--] [path ...]

Publish a new version to GitHub in a controlled way.

Behavior:
  - If paths are supplied, only those paths are staged.
  - If no paths are supplied, only tracked modifications are staged.
  - Untracked files are refused by default unless you explicitly opt in.
  - After push, the script watches the matching GitHub Actions workflows.

Options:
  -m, --message <text>       Commit message
  --include-untracked        Stage untracked non-ignored files as well
  --skip-wait                Push and exit without waiting for Actions
  -h, --help                 Show this help text
EOF
}

message=""
include_untracked=false
skip_wait=false
declare -a path_args=()
declare -a staged_paths=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      shift
      [[ $# -gt 0 ]] || { echo "Missing value for --message" >&2; exit 1; }
      message="$1"
      ;;
    --include-untracked)
      include_untracked=true
      ;;
    --skip-wait)
      skip_wait=true
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        path_args+=("$1")
        shift
      done
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      path_args+=("$1")
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

if [[ ${#path_args[@]} -gt 0 ]]; then
  git add -- "${path_args[@]}"
elif [[ "$include_untracked" == true ]]; then
  git add -A
else
  git add -u
fi

if [[ ${#path_args[@]} -eq 0 && "$include_untracked" != true ]]; then
  mapfile -t untracked < <(git ls-files --others --exclude-standard)
  if [[ ${#untracked[@]} -gt 0 ]]; then
    echo "Refusing to publish with untracked files present unless you select them explicitly." >&2
    printf '  %s\n' "${untracked[@]}" >&2
    echo "Rerun with explicit paths or --include-untracked." >&2
    exit 1
  fi
fi

if [[ -z "$(git diff --cached --name-only)" ]]; then
  echo "No staged changes to publish."
  exit 0
fi

while IFS= read -r staged_path; do
  staged_paths+=("$staged_path")
done < <(git diff --cached --name-only)

if [[ -z "$message" ]]; then
  message="Publish ${branch} at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

git commit -m "$message"
git push -u origin "$branch"

if [[ "$skip_wait" == true ]]; then
  exit 0
fi

bash scripts/watch-github-actions-deploy.sh --sha "$(git rev-parse HEAD)" --branch "$branch"
