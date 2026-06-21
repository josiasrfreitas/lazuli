#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${CHROME_DEVTOOLS_MCP_PROFILE:-$HOME/.cache/chrome-devtools-mcp/chrome-profile}"
SHOULD_KILL=0
SHOULD_FORCE=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/kill-stale-chrome-devtools-mcp.sh [--kill] [--force]

Lists Chrome DevTools MCP processes that commonly keep the MCP profile locked.

Options:
  --kill     Send TERM to matched processes.
  --force    With --kill, send KILL after a short wait if processes remain.
  --help     Show this help.

Environment:
  CHROME_DEVTOOLS_MCP_PROFILE  Override the profile path to match.
USAGE
}

while (($#)); do
  case "$1" in
    --kill)
      SHOULD_KILL=1
      ;;
    --force)
      SHOULD_KILL=1
      SHOULD_FORCE=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

current_pid="$$"
matches_file="$(mktemp "${TMPDIR:-/tmp}/chrome-devtools-mcp-matches.XXXXXX")"
remaining_file="$(mktemp "${TMPDIR:-/tmp}/chrome-devtools-mcp-remaining.XXXXXX")"

cleanup() {
  rm -f "$matches_file" "$remaining_file"
}

trap cleanup EXIT

process_rows() {
  ps -ax -o pid=,ppid=,command= | awk -v self="$current_pid" -v profile="$PROFILE_DIR" '
    $1 == self { next }
    /awk -v self=/ { next }
    /kill-stale-chrome-devtools-mcp\.sh/ { next }
    /chrome-devtools-mcp/ || index($0, profile) { print }
  '
}

process_rows > "$matches_file"

if [[ ! -s "$matches_file" ]]; then
  echo "No stale Chrome DevTools MCP processes found."
  exit 0
fi

echo "Matched Chrome DevTools MCP processes:"
cat "$matches_file"

pids="$(awk '{ print $1 }' "$matches_file" | sort -n | uniq | tr '\n' ' ')"

if [[ "$SHOULD_KILL" -eq 0 ]]; then
  echo
  echo "Dry run only. Re-run with --kill to terminate these processes."
  exit 0
fi

echo
echo "Sending TERM to: $pids"
# shellcheck disable=SC2086
kill $pids 2>/dev/null || true

if [[ "$SHOULD_FORCE" -eq 1 ]]; then
  sleep 1
  process_rows | awk '{ print $1 }' | sort -n | uniq > "$remaining_file"
  if [[ -s "$remaining_file" ]]; then
    remaining_pids="$(tr '\n' ' ' < "$remaining_file")"
    echo "Still running after TERM. Sending KILL to: $remaining_pids"
    # shellcheck disable=SC2086
    kill -9 $remaining_pids 2>/dev/null || true
  fi
fi

echo "Done."
