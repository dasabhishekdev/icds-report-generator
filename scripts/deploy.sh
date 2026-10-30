#!/usr/bin/env bash
# Production deploy — runs on the VPS (manually or from GitHub Actions).
# Builds new web/api images, swaps the containers, verifies them and rolls back on failure.
# MongoDB keeps running; its data lives in the icds-mongo-data volume.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGES=(icds-report-generator-web icds-report-generator-api)
CONTAINERS=(icds-web icds-api icds-mongo)
export GIT_SHA="${GIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo manual)}"

if ! docker network inspect web >/dev/null 2>&1; then
  echo "Docker network 'web' is missing — start the hosting router first (cd ~/hosting && docker compose up -d)." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "==> Creating .env with a random MongoDB password (kept on this server only)"
  umask 077
  sed "s/^MONGO_ROOT_PASSWORD=.*/MONGO_ROOT_PASSWORD=$(openssl rand -hex 24)/" .env.example > .env
fi

wait_healthy() {
  local name status
  for name in "${CONTAINERS[@]}"; do
    for _ in $(seq 1 45); do
      status="$(docker inspect --format '{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)"
      [[ "$status" == healthy ]] && continue 2
      sleep 2
    done
    echo "Container $name did not become healthy (last status: $status)." >&2
    return 1
  done
}

smoke_test() {
  local curl=(docker run --rm --network web curlimages/curl:8.10.1 -fsS)
  "${curl[@]}" http://icds-web:8080/healthz >/dev/null &&
    "${curl[@]}" http://icds-web:8080/ | grep -q '<div id="root">' &&
    "${curl[@]}" http://icds-web:8080/api/health | grep -q '"ok":true'
}

had_previous=true
for image in "${IMAGES[@]}"; do
  if docker image inspect "$image:latest" >/dev/null 2>&1; then
    docker tag "$image:latest" "$image:previous"
  else
    had_previous=false
  fi
done

echo "==> Building images ($GIT_SHA)"
docker compose build --pull

echo "==> Starting containers"
docker compose up -d --remove-orphans

echo "==> Verifying"
if wait_healthy && smoke_test; then
  for image in "${IMAGES[@]}"; do
    docker tag "$image:latest" "$image:$GIT_SHA"
    docker image prune -f --filter "label=org.opencontainers.image.title=$image" >/dev/null
  done
  docker compose ps
  echo "Deploy complete: $GIT_SHA"
  exit 0
fi

echo "==> Deploy failed — rolling back" >&2
docker compose logs --tail 50 web api >&2 || true
if [[ "$had_previous" == true ]]; then
  for image in "${IMAGES[@]}"; do docker tag "$image:previous" "$image:latest"; done
  docker compose up -d --no-build --force-recreate web api
  wait_healthy && echo "Rolled back to previous images." >&2
fi
exit 1
