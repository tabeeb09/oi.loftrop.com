#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/watch-github-actions-deploy.sh [options]

Watch the GitHub Actions runs associated with a specific commit on the current
branch and exit non-zero if a required workflow fails.

Options:
  --repository <owner/repo>  GitHub repository (default: derived from origin)
  --sha <commit-sha>         Commit SHA to watch (default: HEAD)
  --branch <branch>          Branch name (default: current branch)
  --timeout-minutes <mins>   Timeout in minutes (default: 25)
  --poll-seconds <secs>      Poll interval in seconds (default: 15)
  --skip-print               Do not wait for the print deploy workflow
  -h, --help                 Show this help text
EOF
}

repository=""
sha=""
branch=""
timeout_minutes=25
poll_seconds=15
skip_print=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repository)
      shift
      repository="${1:-}"
      ;;
    --sha)
      shift
      sha="${1:-}"
      ;;
    --branch)
      shift
      branch="${1:-}"
      ;;
    --timeout-minutes)
      shift
      timeout_minutes="${1:-}"
      ;;
    --poll-seconds)
      shift
      poll_seconds="${1:-}"
      ;;
    --skip-print)
      skip_print=true
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

if [[ -z "$branch" ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
fi

if [[ "$branch" == "HEAD" ]]; then
  echo "Refusing to watch workflows from a detached HEAD state." >&2
  exit 1
fi

if [[ -z "$sha" ]]; then
  sha="$(git rev-parse HEAD)"
fi

if [[ -z "$repository" ]]; then
  origin_url="$(git remote get-url origin)"
  repository="$(
    node -e '
      const url = process.argv[1];
      const ssh = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      if (!ssh) process.exit(1);
      process.stdout.write(ssh[1]);
    ' "$origin_url"
  )"
fi

api_base="https://api.github.com/repos/${repository}/actions/workflows"
deadline=$(( $(date +%s) + timeout_minutes * 60 ))

fetch_run_state() {
  local workflow_id="$1"
  local label="$2"
  local payload=""
  local attempt

  for attempt in 1 2 3; do
    if payload="$(curl -fsSL -H 'User-Agent: website-actions-watcher' \
      "${api_base}/${workflow_id}/runs?per_page=20&branch=${branch}")"; then
      break
    fi
    sleep 2
  done

  if [[ -z "$payload" ]]; then
    printf '%s|pending|||\n' "$label"
    return 0
  fi

  printf '%s' "$payload" | node -e '
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(0, "utf8"));
    const sha = process.argv[1];
    const label = process.argv[2];
    const run = (payload.workflow_runs || []).find((item) => item.head_sha === sha);
    if (!run) {
      process.stdout.write(`${label}|missing|||\n`);
      process.exit(0);
    }
    process.stdout.write(
      `${label}|${run.status}|${run.conclusion || ""}|${run.html_url || ""}|${run.name || ""}\n`
    );
  ' "$sha" "$label"
}

print_header=false
while [[ "$(date +%s)" -lt "$deadline" ]]; do
  mapfile -t states < <(
    fetch_run_state 289528857 build
    fetch_run_state 289528856 app
    if [[ "$skip_print" != true ]]; then
      fetch_run_state 298801780 print
    fi
  )

  all_ready=true
  if [[ "$print_header" == false ]]; then
    echo "Watching workflows for ${repository}@${sha} on ${branch}"
    print_header=true
  fi

  for state in "${states[@]}"; do
    IFS='|' read -r label status conclusion url workflow_name <<<"$state"
    case "$status" in
      missing)
        echo "${label}: waiting for run to appear"
        all_ready=false
        ;;
      completed)
        echo "${label}: ${conclusion:-completed} ${url}"
        if [[ "$conclusion" != "success" ]]; then
          echo "${workflow_name:-$label} failed." >&2
          exit 1
        fi
        ;;
      pending)
        echo "${label}: waiting for GitHub API"
        all_ready=false
        ;;
      *)
        echo "${label}: ${status:-unknown} ${url}"
        all_ready=false
        ;;
    esac
  done

  if [[ "$all_ready" == true ]]; then
    exit 0
  fi

  sleep "$poll_seconds"
done

echo "Timed out waiting for GitHub Actions runs for ${sha}." >&2
exit 1
