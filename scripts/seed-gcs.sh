#!/usr/bin/env bash
# Upload local fixture files into the current worktree's fake-gcs-server bucket.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/worktree-gcs.sh
source "$SCRIPT_DIR/lib/worktree-gcs.sh"
# shellcheck source=lib/docker-engines.sh
source "$SCRIPT_DIR/lib/docker-engines.sh"

SEED_DIR="${GCS_SEED_DIR:-$ROOT/infra/local/gcs-seed}"
BUCKET=""
FORCE=0
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/seed-gcs.sh [options]
  pnpm seed:gcs -- [options]

Upload files from infra/local/gcs-seed/ into the worktree GCS bucket on the
local fake-gcs-server emulator. Object keys mirror paths under the seed dir.

Options:
  --bucket NAME   Target bucket (default: lazuli-<branch_slug> for current branch)
  --seed-dir DIR  Fixture root (default: infra/local/gcs-seed)
  --force         Re-upload objects even when they already exist
  --dry-run       Print planned uploads without sending data
  --help          Show this help

Examples:
  pnpm seed:gcs
  pnpm seed:gcs -- --force
  pnpm seed:gcs -- --bucket lazuli-main
USAGE
}

while (($#)); do
  case "$1" in
    --bucket)
      BUCKET="${2:-}"
      if [[ -z "$BUCKET" ]]; then
        echo "Missing value for --bucket" >&2
        exit 2
      fi
      shift
      ;;
    --seed-dir)
      SEED_DIR="${2:-}"
      if [[ -z "$SEED_DIR" ]]; then
        echo "Missing value for --seed-dir" >&2
        exit 2
      fi
      shift
      ;;
    --force)
      FORCE=1
      ;;
    --dry-run)
      DRY_RUN=1
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

if [[ -z "$BUCKET" ]]; then
  BUCKET="$(worktree_gcs_bucket_name)" || exit 1
fi

if [[ ! -d "$SEED_DIR" ]]; then
  echo "Seed directory not found: $SEED_DIR" >&2
  exit 1
fi

if ! fake_gcs_healthy; then
  echo "fake-gcs-server is not reachable at $FAKE_GCS_HOST" >&2
  echo "Start engines with: docker compose up -d" >&2
  exit 1
fi

ensure_worktree_gcs_bucket "$BUCKET"

content_type_for() {
  local file="$1"
  case "$file" in
    *.csv) printf 'text/csv' ;;
    *.json) printf 'application/json' ;;
    *.pdf) printf 'application/pdf' ;;
    *.txt) printf 'text/plain' ;;
    *) printf 'application/octet-stream' ;;
  esac
}

gcs_object_exists() {
  local bucket="$1"
  local object_key="$2"
  local encoded_key status

  encoded_key="$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$object_key")"
  status="$(curl -s -o /dev/null -w '%{http_code}' \
    "${FAKE_GCS_HOST}/storage/v1/b/${bucket}/o/${encoded_key}")"
  [[ "$status" == "200" ]]
}

upload_count=0
skip_count=0

while IFS= read -r -d '' file; do
  rel="${file#"$SEED_DIR"/}"
  object_key="${rel#./}"
  content_type="$(content_type_for "$file")"

  if [[ "$FORCE" -eq 0 ]] && gcs_object_exists "$BUCKET" "$object_key"; then
    echo "Skipping existing object: gs://${BUCKET}/${object_key}"
    skip_count=$((skip_count + 1))
    continue
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Would upload: $file -> gs://${BUCKET}/${object_key} (${content_type})"
    upload_count=$((upload_count + 1))
    continue
  fi

  echo "Uploading: gs://${BUCKET}/${object_key}"
  encoded_name="$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$object_key")"
  curl -fsS -X POST \
    -H "Content-Type: ${content_type}" \
    --data-binary @"$file" \
    "${FAKE_GCS_HOST}/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encoded_name}" >/dev/null
  upload_count=$((upload_count + 1))
done < <(find "$SEED_DIR" -type f -not -name '.gitkeep' -print0)

if [[ "$upload_count" -eq 0 && "$skip_count" -eq 0 ]]; then
  echo "No fixture files found under $SEED_DIR"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run complete: $upload_count object(s) would be uploaded to gs://${BUCKET}/"
else
  echo "GCS seed complete: $upload_count uploaded, $skip_count skipped (gs://${BUCKET}/)"
fi
