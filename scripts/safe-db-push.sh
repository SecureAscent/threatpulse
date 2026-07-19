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
LOCKED_CORE_DIFF_FILE="${BACKUP_DIR}/schema_core_locked_${TIMESTAMP}.sql"
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
        OR query ILIKE 'CREATE UNIQUE INDEX%'
        OR query ILIKE 'ALTER TABLE%'
        OR query ILIKE 'CREATE TABLE%'
        OR query ILIKE 'DROP INDEX%'
        OR query ILIKE '%prisma%'
      );
  " >/dev/null 2>&1 || true
}

terminate_all_application_sessions() {
  $COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND usename = '${DB_USER}';
  " >/dev/null
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
terminate_all_application_sessions

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

# Generate the exact SQL Prisma wants for the live database. Every CREATE INDEX
# statement, including every CREATE UNIQUE INDEX statement, is moved to a separate
# non-transactional phase and rewritten with CONCURRENTLY. This avoids index builds
# while the core DDL transaction holds locks on existing production tables.
echo "==> Generating Prisma schema diff: $RAW_DIFF_FILE"
$COMPOSE run --rm -T --no-deps \
  --entrypoint sh \
  app \
  -c 'cd /app/prisma-tools && ./node_modules/.bin/prisma migrate diff --from-schema-datasource /app/prisma-tools/prisma/schema.prisma --to-schema-datamodel /app/prisma-tools/prisma/schema.prisma --script' \
  > "$RAW_DIFF_FILE"

: > "$DEFERRED_INDEX_FILE"
awk '
  /^CREATE UNIQUE INDEX / {
    sub(/^CREATE UNIQUE INDEX /, "CREATE UNIQUE INDEX CONCURRENTLY ")
    print > deferred
    next
  }
  /^CREATE INDEX / {
    sub(/^CREATE INDEX /, "CREATE INDEX CONCURRENTLY ")
    print > deferred
    next
  }
  { print }
' deferred="$DEFERRED_INDEX_FILE" "$RAW_DIFF_FILE" > "$CORE_DIFF_FILE"

if grep -Eq '^CREATE( UNIQUE)? INDEX ' "$CORE_DIFF_FILE"; then
  echo "ERROR: An index statement remained in the core migration." >&2
  grep -nE '^CREATE( UNIQUE)? INDEX ' "$CORE_DIFF_FILE" >&2 || true
  exit 1
fi

RAW_INDEX_COUNT="$(grep -Ec '^CREATE( UNIQUE)? INDEX ' "$RAW_DIFF_FILE" || true)"
DEFERRED_INDEX_COUNT="$(grep -Ec '^CREATE( UNIQUE)? INDEX CONCURRENTLY ' "$DEFERRED_INDEX_FILE" || true)"

if [ "$RAW_INDEX_COUNT" != "$DEFERRED_INDEX_COUNT" ]; then
  echo "ERROR: Index split mismatch: generated $RAW_INDEX_COUNT indexes but deferred $DEFERRED_INDEX_COUNT." >&2
  exit 1
fi

echo "==> Deferred $DEFERRED_INDEX_COUNT index statements from the core transaction"

# Drain once more immediately before applying SQL, then acquire an ACCESS
# EXCLUSIVE lock inside the same transaction so core table and constraint changes
# have a stable view. No CREATE INDEX statement is permitted in this file.
echo "==> Draining database sessions immediately before schema lock"
terminate_all_application_sessions

{
  printf '%s\n' 'LOCK TABLE "Threat" IN ACCESS EXCLUSIVE MODE;'
  cat "$CORE_DIFF_FILE"
} > "$LOCKED_CORE_DIFF_FILE"

echo "==> Applying core schema SQL transactionally: $LOCKED_CORE_DIFF_FILE"
$COMPOSE exec -T postgres \
  psql -X -1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < "$LOCKED_CORE_DIFF_FILE"

# Clean up any dead or aborted tuples left by previously terminated writers before
# PostgreSQL scans Threat to build its new tenant-uniqueness index.
echo "==> Vacuuming Threat before deferred index creation"
$COMPOSE exec -T postgres \
  psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c 'VACUUM (ANALYZE, FREEZE) "Threat";'

if [ -s "$DEFERRED_INDEX_FILE" ]; then
  echo "==> Applying all deferred indexes concurrently: $DEFERRED_INDEX_FILE"
  # Do not add -1 here: CREATE INDEX CONCURRENTLY must run outside a transaction.
  $COMPOSE exec -T postgres \
    psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < "$DEFERRED_INDEX_FILE"
else
  rm -f "$DEFERRED_INDEX_FILE"
  echo "==> No indexes required deferral"
fi

echo "==> Schema and deferred index deployment completed successfully"
