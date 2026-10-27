#!/usr/bin/env bash
set -euo pipefail
archive=$1
install -d /opt/lazuli/document-prototype
aws s3 cp "$archive" /tmp/document-prototype.tar.gz --region us-east-2 >/dev/null
tar -xzf /tmp/document-prototype.tar.gz -C /opt/lazuli/document-prototype
rm /tmp/document-prototype.tar.gz
if [ ! -f /opt/lazuli/document-prototype.env ]; then
  umask 077
  printf 'PROTOTYPE_ADMIN_SECRET=%s\nLAZULI_ENV=staging\nAWS_REGION=us-east-2\nHOST=0.0.0.0\nPORT=3099\n' "$(openssl rand -hex 32)" > /opt/lazuli/document-prototype.env
fi
image=$(docker inspect lazuli-web --format '{{.Image}}')
docker rm -f lazuli-document-prototype >/dev/null 2>&1 || true
docker run -d --name lazuli-document-prototype --network lazuli --restart unless-stopped \
  --publish 127.0.0.1:3099:3099 --env-file /opt/lazuli/document-prototype.env \
  --mount type=bind,src=/opt/lazuli/document-prototype,dst=/prototype,readonly \
  --entrypoint node "$image" /prototype/server.mjs >/dev/null
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3099/document-prototype/ >/dev/null; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3099/document-prototype/ >/dev/null
cp /opt/lazuli/caddy/Caddyfile /opt/lazuli/caddy/Caddyfile.before-document-prototype
cat > /opt/lazuli/caddy/Caddyfile <<'CADDY'
staging.lazuli.fisklagarto.com.br {
  handle /document-prototype/internal/* {
    respond 404
  }
  handle /document-prototype/* {
    reverse_proxy lazuli-document-prototype:3099
  }
  handle {
    reverse_proxy lazuli-web:3000
  }
}
CADDY
if ! docker exec lazuli-proxy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  cp /opt/lazuli/caddy/Caddyfile.before-document-prototype /opt/lazuli/caddy/Caddyfile
  docker exec lazuli-proxy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
  exit 1
fi
printf 'PASS: prototype deployed\n'
