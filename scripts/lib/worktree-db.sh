#!/usr/bin/env bash
# Branch-scoped Postgres database helpers for git worktrees.

worktree_database_name() {
  local branch="${1:-}"
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  fi
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    echo "Cannot resolve git branch for worktree database name." >&2
    return 1
  fi

  local slug name
  slug="$(printf '%s' "$branch" | tr '/-' '__' | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_')"
  name="lazuli_${slug}"
  if ((${#name} > 63)); then
    name="${name:0:63}"
  fi
  printf '%s\n' "$name"
}

worktree_database_url() {
  local db_name="$1"
  printf 'postgresql://lazuli:lazuli@localhost:5432/%s?schema=public\n' "$db_name"
}

patch_env_database_url() {
  local env_file="$1"
  local database_url="$2"

  if [[ ! -f "$env_file" ]]; then
    echo "Env file not found: $env_file" >&2
    return 1
  fi

  local tmp
  tmp="$(mktemp)"
  if grep -q '^DATABASE_URL=' "$env_file"; then
    awk -v url="$database_url" '
      /^DATABASE_URL=/ { print "DATABASE_URL=" url; next }
      { print }
    ' "$env_file" >"$tmp"
  else
    cat "$env_file" >"$tmp"
    printf 'DATABASE_URL=%s\n' "$database_url" >>"$tmp"
  fi
  mv "$tmp" "$env_file"
}

apply_worktree_database_url() {
  local env_file="${1:-.env}"
  local db_name database_url

  db_name="$(worktree_database_name)" || return 1
  database_url="$(worktree_database_url "$db_name")"
  patch_env_database_url "$env_file" "$database_url"
  echo "Set DATABASE_URL for worktree database: $db_name"
}

ensure_worktree_database() {
  local db_name="${1:-}"
  if [[ -z "$db_name" ]]; then
    db_name="$(worktree_database_name)" || return 1
  fi

  if ! docker exec lazuli-postgres psql -U lazuli -d postgres -v ON_ERROR_STOP=1 -tc \
    "SELECT 1 FROM pg_database WHERE datname = '${db_name}'" | grep -q 1; then
    echo "Creating Postgres database: $db_name"
    docker exec lazuli-postgres psql -U lazuli -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${db_name};"
  else
    echo "Postgres database already exists: $db_name"
  fi
}
