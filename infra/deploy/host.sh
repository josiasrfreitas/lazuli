#!/usr/bin/env bash
# Runs as root via SSM. Never enable xtrace or print environment/SSM responses.
set -euo pipefail
umask 077
mode=${1:?prepare or activate}
environment=${2:?staging or prod}
image=${3:?immutable ECR image}
case "$mode" in prepare|activate) ;; *) exit 2 ;; esac
case "$environment" in staging|prod) ;; *) exit 2 ;; esac
repository="413781344359.dkr.ecr.us-east-2.amazonaws.com/lazuli/$environment"
[[ "$image" == "$repository@sha256:"* && "${image##*:}" =~ ^[a-f0-9]{64}$ ]] || exit 2
export AWS_DEFAULT_REGION=us-east-2
release="/opt/lazuli/releases/${image##*:}"
install -d -m 0700 "$release"
exec 9>/opt/lazuli/deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
test -f /opt/lazuli/host-ready
test -s /opt/lazuli/rds-ca.pem
docker network inspect lazuli >/dev/null 2>&1 || docker network create lazuli >/dev/null

if [[ "$mode" == prepare ]]; then
  aws ecr get-login-password | docker login --username AWS --password-stdin "${repository%%/*}" >/dev/null 2>&1
  docker pull "$image" >/dev/null
  prefix="/lazuli/$environment/runtime"
  names=("$prefix/CONFIG" "$prefix/DATABASE_URL" "$prefix/BETTER_AUTH_SECRET" "$prefix/HATCHET_CLIENT_TOKEN" "$prefix/GOOGLE_CLIENT_ID" "$prefix/GOOGLE_CLIENT_SECRET")
  if [[ "$environment" == prod ]]; then names+=("$prefix/RESEND_API_KEY"); fi
  response=$(mktemp "$release/parameters.XXXXXX")
  trap 'rm -f "$response"' EXIT
  aws ssm get-parameters --names "${names[@]}" --with-decryption > "$response"
  # JSON config contains non-secret settings; individual SecureStrings override it.
  jq -er '
    (.Parameters | map(select(.Name | endswith("/CONFIG"))) | .[0].Value | fromjson) as $config |
    (.Parameters | map(select(.Name | endswith("/CONFIG") | not)) |
      map({key: (.Name | split("/") | last), value: .Value}) | from_entries) as $secrets |
    ($config + $secrets) | to_entries[] |
    if (.key | test("^[A-Z][A-Z0-9_]*$")) and (.value | type == "string") and
       (.value | test("[\\r\\n]") | not)
    then "\(.key)=\(.value)" else error("Invalid environment value") end
  ' "$response" > "$release/runtime.env"
  docker run --rm --network lazuli --env-file "$release/runtime.env" \
    --mount type=bind,src=/opt/lazuli/rds-ca.pem,dst=/opt/lazuli/rds-ca.pem,readonly \
    "$image" pnpm runtime:check:remote
  if [[ "$environment" == staging ]]; then
    test "$(docker inspect --format '{{.State.Health.Status}}' mailpit)" = healthy
  fi
  touch "$release/prepared"
  echo 'PASS: image pulled and runtime configuration checked'
  exit 0
fi

test -f "$release/prepared"
# Validate database connectivity before replacing either running process.
docker run --rm --network lazuli --env-file "$release/runtime.env" \
  --mount type=bind,src=/opt/lazuli/rds-ca.pem,dst=/opt/lazuli/rds-ca.pem,readonly \
  "$image" node infra/deploy/check-database.mjs

rollback() {
  trap - ERR
  echo 'Deployment failed; restoring previous application containers. Database migrations are not reverted.'
  for service in web worker; do
    docker rm -f "lazuli-$service" >/dev/null 2>&1 || true
    if docker container inspect "lazuli-$service-previous" >/dev/null 2>&1; then
      docker rename "lazuli-$service-previous" "lazuli-$service"
      docker start "lazuli-$service" >/dev/null
    fi
  done
  exit 1
}
# Retain previous containers with their original environment for rollback.
for service in worker web; do
  docker rm -f "lazuli-$service-previous" >/dev/null 2>&1 || true
  if docker container inspect "lazuli-$service" >/dev/null 2>&1; then
    docker stop --time 150 "lazuli-$service" >/dev/null
    docker rename "lazuli-$service" "lazuli-$service-previous"
  fi
done
trap rollback ERR
common=(--detach --network lazuli --restart unless-stopped --init --stop-timeout 150
  --env-file "$release/runtime.env"
  --mount type=bind,src=/opt/lazuli/rds-ca.pem,dst=/opt/lazuli/rds-ca.pem,readonly)
docker run "${common[@]}" --name lazuli-web --publish 127.0.0.1:3000:3000 \
  "$image" pnpm start:remote >/dev/null
docker run "${common[@]}" --name lazuli-worker \
  --env LAZULI_WORKER_READY_FILE=/tmp/lazuli-worker-ready \
  "$image" pnpm start:worker:remote >/dev/null
healthy=false
for _ in $(seq 1 60); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/login >/dev/null &&
    docker exec lazuli-worker test -s /tmp/lazuli-worker-ready; then
    healthy=true
    break
  fi
  sleep 2
done
test "$healthy" = true

# Caddy owns TLS; DNS must already point to this environment's Elastic IP.
app_url=$(sed -n 's/^APP_URL=//p' "$release/runtime.env")
host=${app_url#https://}
host=${host%/}
[[ "$host" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]]
install -d -m 0755 /opt/lazuli/caddy
printf '%s {\n  reverse_proxy lazuli-web:3000\n}\n' "$host" > /opt/lazuli/caddy/Caddyfile
chmod 0644 /opt/lazuli/caddy/Caddyfile
if docker container inspect lazuli-proxy >/dev/null 2>&1; then
  docker exec lazuli-proxy caddy reload --config /etc/caddy/Caddyfile >/dev/null
else
  docker run -d --name lazuli-proxy --network lazuli --restart unless-stopped \
    -p 80:80 -p 443:443 \
    --mount type=bind,src=/opt/lazuli/caddy,dst=/etc/caddy,readonly \
    --mount type=volume,src=lazuli-caddy-data,dst=/data \
    --mount type=volume,src=lazuli-caddy-config,dst=/config \
    caddy:2.10.2 >/dev/null
fi
public_healthy=false
for _ in $(seq 1 60); do
  if curl --fail --silent --max-time 5 "$app_url/login" >/dev/null; then
    public_healthy=true
    break
  fi
  sleep 3
done
test "$public_healthy" = true
printf '%s\n' "$image" > /opt/lazuli/current-image
trap - ERR
echo 'PASS: database, web HTTPS and worker registration'
