#!/usr/bin/env bash
# Writes a compressed MongoDB dump to backups/ on the VPS. Schedule with cron, e.g.
#   15 2 * * * cd ~/icds-report-generator && bash scripts/backup-mongo.sh >/dev/null
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
source .env
set +a

mkdir -p backups
chmod 700 backups
FILE="backups/icds-$(date +%Y%m%d-%H%M%S).archive.gz"
docker exec icds-mongo mongodump --quiet --archive --gzip --db icds \
  --username "${MONGO_ROOT_USER:-icds}" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin > "$FILE"
chmod 600 "$FILE"
find backups -name 'icds-*.archive.gz' -mtime +30 -delete
echo "Backup written: $FILE"
