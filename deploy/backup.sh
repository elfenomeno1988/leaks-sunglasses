#!/usr/bin/env bash
# LEAKS — sauvegarde quotidienne de la base (à lancer par cron sur le VPS).
# Installation :  crontab -e  →  0 3 * * * /root/leaks-sunglasses/deploy/backup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DIR=/var/backups/leaks
mkdir -p "$DIR"

STAMP=$(date +%Y-%m-%d)
docker compose exec -T db pg_dump -U leaks leaks | gzip > "$DIR/leaks-$STAMP.sql.gz"

# On garde 14 jours.
find "$DIR" -name "leaks-*.sql.gz" -mtime +14 -delete

echo "Sauvegarde : $DIR/leaks-$STAMP.sql.gz ($(du -h "$DIR/leaks-$STAMP.sql.gz" | cut -f1))"
