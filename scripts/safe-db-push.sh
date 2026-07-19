#!/bin/sh
set -eu

COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"
DB_USER="${POSTGRES_USER:-threatpulse}"
DB_NAME="${POSTGRES_DB:-threatpulse}"
BACKUP_DIR="backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/pre_schema_${TIMESTAMP}.sql.gz"
RAW_DIFF_FILE="${BACKUP_DIR}/schema_diff_${TIMESTAMP}.sql"
CORE_DIFF_FILE="${BACKUP_DIR}/schema_core_${TIMESTAMP}.sql"
DEFERRED_INDEX_FILE="${BACKUP_DIR}/schema_deferred_indexes_${TIMESTAMP}.sql"
SERVICES_STOPPED=0
WATCHDOG_PID=""

terminate_schema_sessions() {
  $COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND usename = '${DB_USER}'
      AND (
        query ILIKE 'CREATE INDEX%'
        OR query ILIKE 'ALTER TABLE%'
        OR query ILIKE 'CREATE TABLE%'
        OR query ILIKE 'DROP INDEX%'
        OR query ILIKE '%prisma%'
      );
  " >/dev/null 2>&1 || true
}

reset_role_timeouts() {
  $COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    ALTER ROLE \"${DB_USER}\" RESET lock_timeout;
    ALTER ROLE \"${DB_USER}\" RESET statement_timeout;
    ALTER ROLE \"${DB_USER}\" RESET idle_in_transaction_session_timeout;
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
  if [ -n "$WATCHDOG_PID" ]; then
    kill "$WATCHDOG_PID" >/dev/null 2>&1 || true
  fi
  terminate_schema_sessions
  reset_role_timeouts
  restart_services
  exit "$status"
}

trap on_exit EXIT INT TERM HUP

mkdir -p "$BACKUP_DIR"

echo "==> Verifying PostgreSQL is available"
$COMPOSE exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME"

# Prisma schema assets are baked into the production app image at build time.
# Always rebuild before generating the database diff.
echo "==> Rebuilding app image with current Prisma schema"
$COMPOSE build app

echo "==> Creating pre-migration backup: $BACKUP_FILE"
$COMPOSE exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "==> Stopping database writers"
$COMPOSE stop app collector
SERVICES_STOPPED=1

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

echo "==> Enforcing database-side migration timeouts"
$COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
  ALTER ROLE \"${DB_USER}\" SET lock_timeout = '15s';
  ALTER ROLE \"${DB_USER}\" SET statement_timeout = '15min';
  ALTER ROLE \"${DB_USER}\" SET idle_in_transaction_session_timeout = '60s';
"

# Independent database watchdog. It remains effective even if Docker Compose or
# Prisma loses its client connection and leaves a PostgreSQL DDL backend behind.
(
  sleep 1200
  echo "ERROR: Migration watchdog reached 20 minutes; terminating schema sessions." >&2
  terminate_schema_sessions
) &
WATCHDOG_PID=$!

# Generate the exact SQL Prisma wants for the live database. We deliberately
# defer only ordinary secondary indexes because CREATE INDEX is the operation
# that is blocking this production database. CREATE UNIQUE INDEX statements,
# table changes, foreign keys, and constraints remain in the core migration.
echo "==> Generating Prisma schema diff: $RAW_DIFF_FILE"
$COMPOSE run --rm -T --no-deps \
  --entrypoint sh \
  app \
  -c 'cd /app/prisma-tools && ./node_modules/.bin/prisma migrate diff --from-schema-datasource /app/prisma-tools/prisma/schema.prisma --to-schema-datamodel /app/prisma-tools/prisma/schema.prisma --script' \
  > "$RAW_DIFF_FILE"

awk '/^CREATE INDEX / { print > deferred; next } { print }' \
  deferred="$DEFERRED_INDEX_FILE" \
  "$RAW_DIFF_FILE" > "$CORE_DIFF_FILE"

if grep -Eq '^CREATE INDEX ' "$CORE_DIFF_FILE"; then
  echo "ERROR: A non-unique CREATE INDEX statement remained in the core migration." >&2
  exit 1
fi

echo "==> Applying core schema SQL: $CORE_DIFF_FILE"
$COMPOSE exec -T postgres \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < "$CORE_DIFF_FILE"

if [ -s "$DEFERRED_INDEX_FILE" ]; then
  echo "==> Deferred non-unique indexes saved to: $DEFERRED_INDEX_FILE"
else
  rm -f "$DEFERRED_INDEX_FILE"
  echo "==> No non-unique indexes required deferral"
fi

echo "==> Core schema deployment completed successfully"
