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
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

exec node "$SCRIPT_DIR/../workspace-setup.mjs" light
