#!/bin/sh
set -eu

COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"
DB_USER="${POSTGRES_USER:-threatpulse}"
DB_NAME="${POSTGRES_DB:-threatpulse}"
MIGRATION_APP_NAME="threatpulse-schema-migration"
BACKUP_DIR="backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/pre_schema_${TIMESTAMP}.sql.gz"
SERVICES_STOPPED=0

cleanup_migration_sessions() {
  $COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND application_name = '${MIGRATION_APP_NAME}'
      AND pid <> pg_backend_pid();
  " >/dev/null 2>&1 || true
}

restart_services() {
  if [ "$SERVICES_STOPPED" -eq 1 ]; then
    echo "==> Restarting app and collector"
    $COMPOSE up -d app collector
  fi
}

on_exit() {
  status=$?
  trap - EXIT INT TERM HUP
  cleanup_migration_sessions
  restart_services
  exit "$status"
}

trap on_exit EXIT INT TERM HUP

mkdir -p "$BACKUP_DIR"

echo "==> Verifying PostgreSQL is available"
$COMPOSE exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME"

echo "==> Creating pre-migration backup: $BACKUP_FILE"
$COMPOSE exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "==> Stopping database writers"
$COMPOSE stop app collector
SERVICES_STOPPED=1

# Remove sessions left behind by stopped services or interrupted prior migrations.
echo "==> Terminating stale ThreatPulse database sessions"
$COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND usename = '${DB_USER}';
"

echo "==> Checking for duplicate organization/threat keys"
DUPLICATES="$($COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -At -v ON_ERROR_STOP=1 -c '
  SELECT COUNT(*)
  FROM (
    SELECT "organizationId", "threatId"
    FROM "Threat"
    GROUP BY "organizationId", "threatId"
    HAVING COUNT(*) > 1
  ) duplicates;
')"

if [ "$DUPLICATES" != "0" ]; then
  echo "ERROR: Found $DUPLICATES duplicate (organizationId, threatId) groups. Schema deployment aborted." >&2
  exit 1
fi

echo "==> Applying Prisma schema with lock and execution timeouts"
# timeout prevents an interrupted docker client from leaving DDL running forever.
# PGOPTIONS makes lock waits fail quickly and caps the total statement runtime.
timeout --foreground 20m \
  $COMPOSE run --rm \
  --entrypoint sh \
  -e PGOPTIONS="-c application_name=${MIGRATION_APP_NAME} -c lock_timeout=15s -c statement_timeout=15min -c idle_in_transaction_session_timeout=60s" \
  app \
  -c 'cd /app/prisma-tools && ./node_modules/.bin/prisma db push --schema=/app/prisma-tools/prisma/schema.prisma --skip-generate --accept-data-loss'

echo "==> Schema deployment completed successfully"
