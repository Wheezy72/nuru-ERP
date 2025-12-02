#!/usr/bin/env bash
set -euo pipefail

# Simple PostgreSQL backup helper for Nuru.
# This is intended to be run from cron or a scheduled task.
#
# Required environment variables:
#   DATABASE_URL  - full Postgres connection string
#   BACKUP_DIR    - directory to write backups to
#
# Example crontab (daily at 2am):
#   0 2 * * * BACKUP_DIR=/var/backups/nuru DATABASE_URL='postgres://...' /path/to/backup-db.sh

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

if [[ -z "${BACKUP_DIR:-}" ]]; then
  echo "BACKUP_DIR is not set" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

timestamp="$(date +'%Y%m%d-%H%M%S')"
outfile="${BACKUP_DIR}/nuru-backup-${timestamp}.sql"

# Use pg_dump for logical backup. Assumes pg_dump is available in PATH.
echo "Starting backup to ${outfile}..."
PGPASSWORD="$(node -e "console.log(new URL(process.env.DATABASE_URL).password)")" \
  pg_dump "${DATABASE_URL}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    > "${outfile}"

echo "Backup complete."

# Optional: keep only the last 7 backups
find "${BACKUP_DIR}" -name 'nuru-backup-*.sql' -type f -mtime +7 -print -delete || true