#!/usr/bin/env bash
set -euo pipefail

NULL_REF="0000000000000000000000000000000000000000"

if [[ "${1:-}" != "$NULL_REF" ]]; then
  exit 0
fi

if [[ ! -f .git ]]; then
  exit 0
fi

unset GIT_DIR GIT_WORK_TREE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP="$SCRIPT_DIR/../bootstrap-worktree.sh"

args=()
if [[ "${LAZULI_BOOTSTRAP_NO_FIXTURES:-}" =~ ^(1|true|yes|TRUE|YES)$ ]]; then
  args+=(--no-fixtures)
fi

exec bash "$BOOTSTRAP" "${args[@]}"
