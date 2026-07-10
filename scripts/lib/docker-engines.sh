#!/usr/bin/env bash
# Shared local Docker Compose engine health checks (Postgres, Mailpit, Hatchet Lite).

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-lazuli-postgres}"
MAILPIT_CONTAINER="${MAILPIT_CONTAINER:-lazuli-mailpit}"
HATCHET_CONTAINER="${HATCHET_CONTAINER:-lazuli-hatchet}"

container_running() {
  local name="$1"
  docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null | grep -q true
}

postgres_healthy() {
  local health_status
  health_status="$(docker inspect -f '{{.State.Health.Status}}' "$POSTGRES_CONTAINER" 2>/dev/null || true)"
  if [[ "$health_status" == "healthy" ]]; then
    return 0
  fi
  docker exec "$POSTGRES_CONTAINER" pg_isready -U lazuli -d lazuli >/dev/null 2>&1
}

engines_healthy() {
  container_running "$MAILPIT_CONTAINER" &&
    container_running "$HATCHET_CONTAINER" &&
    postgres_healthy
}

wait_for_postgres_healthy() {
  local attempts="${1:-24}"
  local index

  for ((index = 0; index < attempts; index++)); do
    if postgres_healthy; then
      return 0
    fi
    sleep 5
  done

  echo "Postgres did not become healthy in time." >&2
  return 1
}

ensure_docker_engines() {
  if engines_healthy; then
    echo "Shared engines already up (postgres, mailpit, hatchet); skipping docker compose up."
    return 0
  fi

  echo "Starting shared Docker Compose stack..."
  docker compose up -d
  wait_for_postgres_healthy
}
