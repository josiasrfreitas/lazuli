#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/worktree-db.sh
source "$SCRIPT_DIR/lib/worktree-db.sh"
# shellcheck source=lib/worktree-gcs.sh
source "$SCRIPT_DIR/lib/worktree-gcs.sh"
# shellcheck source=lib/docker-engines.sh
source "$SCRIPT_DIR/lib/docker-engines.sh"

SOURCE_WORKTREE=""
SKIP_DOCKER=0
NO_FIXTURES=0
RESET_DB=0
FORCE=0
BOOTSTRAP_MARKER=".worktree-bootstrapped"

usage() {
  cat <<'USAGE'
Usage:
  scripts/bootstrap-worktree.sh [options]
  pnpm bootstrap:worktree -- [options]

Prepare the current checkout for local dev (also run automatically by the
post-checkout hook after `git worktree add`):

  1. .env setup with per-worktree DATABASE_URL and GCS bucket
  2. pnpm install (always)
  3. Docker engine check / start (unless --no-fixtures)
  4. Create isolated Postgres DB + migrate (or db:reset with --reset-db)
  5. Create isolated GCS bucket + seed fixtures
  6. runtime preflight check

Options:
  --source PATH   Checkout that already has a working .env (default: auto-detect
                  from another git worktree, else .env.example)
  --skip-docker   Do not run docker compose up -d (still runs DB steps if Postgres is up)
  --no-fixtures   Skip docker, DB, and runtime check; still runs .env + pnpm install
  --reset-db      Run pnpm db:reset instead of pnpm prisma:deploy
  --force         Re-run bootstrap even if already bootstrapped
  --help          Show this help

Examples:
  pnpm bootstrap:worktree
  pnpm bootstrap:worktree -- --reset-db
  pnpm bootstrap:worktree -- --no-fixtures

Notes:
  - Create worktrees with `git worktree add` (hook bootstraps automatically).
  - Opt out of fixtures at add time:
      LAZULI_BOOTSTRAP_NO_FIXTURES=1 git worktree add <path> <branch>
  - Docker Compose uses fixed ports (5432, 8025, 8888). One stack per machine.
  - Each worktree gets lazuli_<branch_slug> on shared Postgres and lazuli-<branch_slug> on fake-gcs.
USAGE
}

while (($#)); do
  case "$1" in
    --source)
      SOURCE_WORKTREE="${2:-}"
      if [[ -z "$SOURCE_WORKTREE" ]]; then
        echo "Missing value for --source" >&2
        exit 2
      fi
      shift
      ;;
    --skip-docker)
      SKIP_DOCKER=1
      ;;
    --no-fixtures)
      NO_FIXTURES=1
      ;;
    --reset-db)
      RESET_DB=1
      ;;
    --force)
      FORCE=1
      ;;
    --help | -h)
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

print_docker_warning() {
  cat <<'WARNING'

Note: worktree bootstrap may start the shared Docker stack (Postgres, Mailpit,
Hatchet, fake-gcs) when engines are not already running.

Tasks without local fixtures (docs, lint-only):
  LAZULI_BOOTSTRAP_NO_FIXTURES=1 git worktree add <path> <branch>
  pnpm bootstrap:worktree -- --no-fixtures

Stop fixtures when done:
  docker compose down
  docker compose down -v   # destructive — wipes all local DB volumes

WARNING
}

already_bootstrapped() {
  [[ -f "$BOOTSTRAP_MARKER" && -d node_modules && -f .env ]]
}

find_env_source_worktree() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 1
  fi

  local worktree=""
  while IFS= read -r line; do
    case "$line" in
      worktree*)
        worktree="${line#worktree }"
        if [[ "$worktree" != "$ROOT" && -f "$worktree/.env" ]]; then
          printf '%s\n' "$worktree"
          return 0
        fi
        ;;
    esac
  done < <(git worktree list --porcelain)

  return 1
}

resolve_worktree_path() {
  local path="$1"
  if [[ "$path" != /* ]]; then
    path="$ROOT/$path"
  fi
  cd "$path" && pwd -P
}

setup_env() {
  if [[ ! -f .env ]]; then
    local source_worktree=""
    local source_env=""

    if [[ -n "$SOURCE_WORKTREE" ]]; then
      source_worktree="$(resolve_worktree_path "$SOURCE_WORKTREE")"
      source_env="$source_worktree/.env"
      if [[ ! -f "$source_env" ]]; then
        echo "No .env found at --source checkout: $source_worktree" >&2
        exit 1
      fi
    elif source_worktree="$(find_env_source_worktree)"; then
      source_env="$source_worktree/.env"
      echo "Using .env from worktree: $source_worktree"
    fi

    if [[ -n "$source_env" ]]; then
      cp "$source_env" .env
      echo "Copied .env from $source_worktree"
    else
      cp .env.example .env
      echo "Created .env from .env.example."
      echo "Fill BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET before pnpm dev."
    fi
  else
    echo ".env already present; keeping existing secrets."
  fi

  apply_worktree_database_url .env
  apply_worktree_gcs_env .env
}

bootstrap_worktree() {
  if [[ "$FORCE" -eq 0 ]] && already_bootstrapped; then
    echo "Worktree already bootstrapped at $ROOT (use --force to re-run)."
    return 0
  fi

  echo "Bootstrapping worktree at $ROOT"
  print_docker_warning

  setup_env

  echo "Installing dependencies..."
  pnpm install

  if [[ "$NO_FIXTURES" -eq 1 ]]; then
    echo "Skipping fixtures (--no-fixtures): no docker, DB, or runtime check."
    date -u +"%Y-%m-%dT%H:%M:%SZ" >"$BOOTSTRAP_MARKER"
    cat <<DONE

Worktree bootstrap complete (no fixtures).

Checkout: $ROOT

Next:
  cd $ROOT
  pnpm bootstrap:worktree        # enable fixtures when needed
  docker compose down            # stop shared stack if it was started elsewhere

DONE
    return 0
  fi

  if [[ "$SKIP_DOCKER" -eq 0 ]]; then
    ensure_docker_engines
  else
    echo "Skipping docker compose up (--skip-docker)."
    if ! postgres_healthy; then
      echo "Postgres is not healthy; DB steps may fail." >&2
    fi
  fi

  ensure_worktree_database

  ensure_worktree_gcs_bucket
  echo "Seeding GCS fixtures..."
  bash "$SCRIPT_DIR/seed-gcs.sh"

  if [[ "$RESET_DB" -eq 1 ]]; then
    echo "Resetting local database and running seed..."
    pnpm db:reset
  else
    echo "Applying database migrations..."
    pnpm prisma:deploy
  fi

  echo "Running runtime preflight..."
  pnpm runtime:check

  date -u +"%Y-%m-%dT%H:%M:%SZ" >"$BOOTSTRAP_MARKER"

  cat <<DONE

Worktree bootstrap complete.

Checkout: $ROOT

Next:
  cd $ROOT
  pnpm dev          # web app
  pnpm dev:worker   # background worker (optional)

If auth or workers fail, confirm GOOGLE_* and HATCHET_CLIENT_TOKEN in .env.
DONE
}

bootstrap_worktree
