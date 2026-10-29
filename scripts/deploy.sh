#!/usr/bin/env bash
# Production deploy — runs on the VPS (manually or from GitHub Actions).
# Builds a new image, swaps the container, verifies it and rolls back on failure.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGE=icds-report-generator
CONTAINER=icds-web
export GIT_SHA="${GIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo manual)}"

if ! docker network inspect web >/dev/null 2>&1; then
  echo "Docker network 'web' is missing — start the hosting router first (cd ~/hosting && docker compose up -d)." >&2
  exit 1
fi

wait_healthy() {
  for _ in $(seq 1 30); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
    [[ "$status" == healthy ]] && return 0
    sleep 2
  done
  echo "Container $CONTAINER did not become healthy (last status: $status)." >&2
  return 1
}

smoke_test() {
  docker run --rm --network web curlimages/curl:8.10.1 -fsS "http://$CONTAINER:8080/healthz" >/dev/null &&
    docker run --rm --network web curlimages/curl:8.10.1 -fsS "http://$CONTAINER:8080/" | grep -q '<div id="root">'
}

had_previous=false
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
  had_previous=true
fi

echo "==> Building $IMAGE ($GIT_SHA)"
docker compose build --pull

echo "==> Starting $CONTAINER"
docker compose up -d --remove-orphans

echo "==> Verifying"
if wait_healthy && smoke_test; then
  docker tag "$IMAGE:latest" "$IMAGE:$GIT_SHA"
  docker compose ps
  echo "==> Pruning old $IMAGE images"
  docker image prune -f --filter "label=org.opencontainers.image.title=$IMAGE" >/dev/null
  echo "Deploy complete: $GIT_SHA"
  exit 0
fi

echo "==> Deploy failed — rolling back" >&2
docker logs --tail 50 "$CONTAINER" >&2 || true
if [[ "$had_previous" == true ]]; then
  docker tag "$IMAGE:previous" "$IMAGE:latest"
  docker compose up -d --no-build --force-recreate
  wait_healthy && echo "Rolled back to previous image." >&2
fi
exit 1
