#!/usr/bin/env bash
# Branch-scoped GCS bucket helpers for git worktrees (shared fake-gcs-server).

FAKE_GCS_HOST="${FAKE_GCS_HOST:-http://localhost:4443}"
GCS_LOCAL_PROJECT_ID="${GCS_LOCAL_PROJECT_ID:-lazuli-local}"

worktree_gcs_bucket_name() {
  local branch="${1:-}"
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  fi
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    echo "Cannot resolve git branch for worktree GCS bucket name." >&2
    return 1
  fi

  local slug name
  slug="$(printf '%s' "$branch" | tr '/_' '--' | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
  name="lazuli-${slug}"
  if ((${#name} > 63)); then
    name="${name:0:63}"
    name="${name%-}"
  fi
  printf '%s\n' "$name"
}

worktree_storage_emulator_host() {
  printf '%s\n' "$FAKE_GCS_HOST"
}

patch_env_var() {
  local env_file="$1"
  local key="$2"
  local value="$3"

  local tmp
  tmp="$(mktemp)"
  if grep -q "^${key}=" "$env_file"; then
    awk -v key="$key" -v value="$value" '
      $0 ~ "^" key "=" { print key "=" value; next }
      { print }
    ' "$env_file" >"$tmp"
  else
    cat "$env_file" >"$tmp"
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  mv "$tmp" "$env_file"
}

apply_worktree_gcs_env() {
  local env_file="${1:-.env}"
  local bucket_name

  if [[ ! -f "$env_file" ]]; then
    echo "Env file not found: $env_file" >&2
    return 1
  fi

  bucket_name="$(worktree_gcs_bucket_name)" || return 1
  patch_env_var "$env_file" "GCS_ARTIFACTS_BUCKET" "$bucket_name"
  patch_env_var "$env_file" "GCS_PROJECT_ID" "$GCS_LOCAL_PROJECT_ID"
  patch_env_var "$env_file" "STORAGE_EMULATOR_HOST" "$(worktree_storage_emulator_host)"
  echo "Set GCS env for worktree bucket: $bucket_name"
}

gcs_bucket_exists() {
  local bucket_name="$1"
  local status

  status="$(curl -s -o /dev/null -w '%{http_code}' \
    "${FAKE_GCS_HOST}/storage/v1/b/${bucket_name}?project=${GCS_LOCAL_PROJECT_ID}")"
  [[ "$status" == "200" ]]
}

ensure_worktree_gcs_bucket() {
  local bucket_name="${1:-}"
  if [[ -z "$bucket_name" ]]; then
    bucket_name="$(worktree_gcs_bucket_name)" || return 1
  fi

  if gcs_bucket_exists "$bucket_name"; then
    echo "GCS bucket already exists: $bucket_name"
    return 0
  fi

  echo "Creating GCS bucket: $bucket_name"
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${bucket_name}\"}" \
    "${FAKE_GCS_HOST}/storage/v1/b?project=${GCS_LOCAL_PROJECT_ID}" >/dev/null
}
