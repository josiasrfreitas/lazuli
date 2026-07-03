#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SOURCE_WORKTREE=""
WORKTREE_NAME=""
SYMLINK_ENV=0
SKIP_DOCKER=0
RESET_DB=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/bootstrap-worktree.sh [options]
  pnpm bootstrap:worktree -- [options]

Create a git worktree (optional) and prepare it for local dev:
  - git worktree add (with --name)
  - copy or symlink .env from another checkout
  - pnpm install
  - docker compose up -d (shared local stack)
  - prisma migrate deploy (or db:reset with --reset-db)
  - runtime preflight check

Options:
  --name NAME     Create a new worktree at ../<repo>-<name> and bootstrap it.
                  NAME is the git branch (slashes become hyphens in the path).
                  Uses an existing local/remote branch when present; otherwise
                  creates NAME from the current HEAD.
  --source PATH   Checkout that already has a working .env (default: auto-detect
                  from another git worktree, else .env.example; when --name is
                  used, defaults to the checkout you ran this from)
  --symlink-env   Symlink .env instead of copying (keeps secrets in one place)
  --skip-docker   Do not run docker compose up -d
  --reset-db      Run pnpm db:reset instead of pnpm prisma:deploy
  --help          Show this help

Examples:
  pnpm bootstrap:worktree -- --name gre-24 --symlink-env --skip-docker
  pnpm bootstrap:worktree -- --name josiasdev1/gre-24-track-stage-catalog-seed

Notes:
  - Docker Compose uses fixed ports (5432, 8025, 8888). Run it once per machine,
    not once per worktree.
  - With --symlink-env, credential paths in .env should be absolute.
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
    --name)
      WORKTREE_NAME="${2:-}"
      if [[ -z "$WORKTREE_NAME" ]]; then
        echo "Missing value for --name" >&2
        exit 2
      fi
      shift
      ;;
    --symlink-env)
      SYMLINK_ENV=1
      ;;
    --skip-docker)
      SKIP_DOCKER=1
      ;;
    --reset-db)
      RESET_DB=1
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

worktree_path_slug() {
  local name="$1"
  printf '%s' "${name//\//-}"
}

create_worktree() {
  local name="$1"
  local origin_root="$ROOT"
  local parent base slug target

  if ! git -C "$origin_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Cannot create a worktree outside a git repository." >&2
    exit 1
  fi

  parent="$(dirname "$origin_root")"
  base="$(basename "$origin_root")"
  slug="$(worktree_path_slug "$name")"
  target="$parent/${base}-${slug}"

  if [[ -e "$target" ]]; then
    echo "Worktree path already exists: $target" >&2
    exit 1
  fi

  echo "Creating worktree at $target (branch: $name)..."

  if git -C "$origin_root" show-ref --verify --quiet "refs/heads/$name"; then
    git -C "$origin_root" worktree add "$target" "$name"
  elif git -C "$origin_root" show-ref --verify --quiet "refs/remotes/origin/$name"; then
    git -C "$origin_root" worktree add -b "$name" "$target" "origin/$name"
  else
    git -C "$origin_root" worktree add -b "$name" "$target"
  fi

  ROOT="$target"
  cd "$ROOT"

  if [[ -z "$SOURCE_WORKTREE" ]]; then
    SOURCE_WORKTREE="$origin_root"
  fi
}

setup_env() {
  if [[ -e .env ]]; then
    echo ".env already present; skipping env setup."
    return
  fi

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
    if [[ "$SYMLINK_ENV" -eq 1 ]]; then
      ln -s "$source_env" .env
      echo "Symlinked .env -> $source_env"
    else
      cp "$source_env" .env
      echo "Copied .env from $source_worktree"
    fi
    return
  fi

  cp .env.example .env
  echo "Created .env from .env.example."
  echo "Fill BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET before pnpm dev."
}

bootstrap_worktree() {
  echo "Bootstrapping worktree at $ROOT"

  setup_env

  echo "Installing dependencies..."
  pnpm install

  if [[ "$SKIP_DOCKER" -eq 0 ]]; then
    echo "Starting local Docker Compose stack (skip next time with --skip-docker)..."
    docker compose up -d
  else
    echo "Skipping docker compose (--skip-docker)."
  fi

  if [[ "$RESET_DB" -eq 1 ]]; then
    echo "Resetting local database and running seed..."
    pnpm db:reset
  else
    echo "Applying database migrations..."
    pnpm prisma:deploy
  fi

  echo "Running runtime preflight..."
  pnpm runtime:check

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

if [[ -n "$WORKTREE_NAME" ]]; then
  create_worktree "$WORKTREE_NAME"
fi

bootstrap_worktree
