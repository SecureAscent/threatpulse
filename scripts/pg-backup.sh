#!/bin/bash
# ThreatPulse PostgreSQL Backup & Restore
# Usage:
#   ./pg-backup.sh              # create a compressed backup
#   ./pg-backup.sh --list       # list available backups
#   ./pg-backup.sh --restore <file>  # restore from a backup file
#
# Cron (daily at 2 AM): 0 2 * * * /path/to/pg-backup.sh
set -euo pipefail

DB_CONTAINER="threatpulse-postgres"
DB_NAME="threatpulse"
DB_USER="threatpulse"
BACKUP_DIR="/var/backups/threatpulse"
RETENTION_DAYS=7
LOG_FILE="/var/log/threatpulse/pg-backup.log"

mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# --list
if [ "$1" = "--list" ]; then
  echo "Available backups in $BACKUP_DIR:"
  ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (none)"
  exit 0
fi

# --restore <file>
if [ "$1" = "--restore" ]; then
  FILE="$2"
  if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    echo "Usage: $0 --restore <backup-file.sql.gz>"
    exit 1
  fi
  log "=== RESTORE START: $FILE ==="
  log "WARNING: This will DROP and recreate the database. Press Ctrl+C to abort."
  sleep 5

  # Verify the container is running
  if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    log "ERROR: Container $DB_CONTAINER is not running."
    exit 1
  fi

  # Drop and recreate
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"

  # Restore
  gunzip -c "$FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" 2>&1 | tee -a "$LOG_FILE"

  log "=== RESTORE COMPLETE ==="
  exit 0
fi

# Default: create backup
log "=== Backup Started ==="

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  log "ERROR: Container $DB_CONTAINER is not running. Aborting."
  exit 1
fi

TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/threatpulse_${TIMESTAMP}.sql.gz"

# Compressed pg_dump
log "Creating compressed backup: $BACKUP_FILE"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges | gzip > "$BACKUP_FILE"

# Verify the backup is non-empty
FILE_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
if [ "$FILE_SIZE" -lt 100 ]; then
  log "ERROR: Backup file is suspiciously small ($FILE_SIZE bytes). Removing and aborting."
  rm -f "$BACKUP_FILE"
  exit 1
fi

log "Backup complete: $(du -h "$BACKUP_FILE" | cut -f1)"

# Rotate old backups
log "Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "threatpulse_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(find "$BACKUP_DIR" -name "threatpulse_*.sql.gz" | wc -l)
log "Backups retained: $REMAINING"

log "=== Backup Complete ==="