#!/usr/bin/env bash
set -euo pipefail
environment=${1:?environment}
image=${2:?image digest}
case "$environment" in staging|prod) ;; *) exit 2 ;; esac
repository="413781344359.dkr.ecr.us-east-2.amazonaws.com/lazuli/$environment"
[[ "$image" == "$repository@sha256:"* && "${image##*:}" =~ ^[a-f0-9]{64}$ ]] || exit 2
export AWS_DEFAULT_REGION=us-east-2
exec 9>/opt/lazuli/deploy.lock
flock -n 9
cleanup() { docker rm -f lazuli-deploy-smoke >/dev/null 2>&1 || true; }
trap cleanup EXIT
aws ecr get-login-password | docker login --username AWS --password-stdin "${repository%%/*}" >/dev/null 2>&1
docker pull "$image" >/dev/null
for release in first second; do
  cleanup
  docker run -d --name lazuli-deploy-smoke --publish 127.0.0.1:18080:8080 \
    --memory 64m --cpus 0.25 --env "RELEASE=$release" "$image" >/dev/null
  healthy=false
  for _ in $(seq 1 20); do
    if [[ "$(curl --fail --silent --max-time 2 http://127.0.0.1:18080/health || true)" == "$release" ]]; then
      healthy=true
      break
    fi
    sleep 1
  done
  test "$healthy" = true
  echo "PASS: small deployment $release returned the expected version"
done
cleanup
if docker container inspect lazuli-deploy-smoke >/dev/null 2>&1; then exit 1; fi
echo 'PASS: smoke containers removed; application containers unchanged'
