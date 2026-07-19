#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
SERVICES_STOPPED=false

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Environment file '$ENV_FILE' was not found." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: Compose file '$COMPOSE_FILE' was not found." >&2
  exit 1
fi

# Resolve the actual database identity from the fully interpolated Compose config.
DB_USER="$(${COMPOSE[@]} run --rm --no-deps --entrypoint sh postgres -c 'printf %s "$POSTGRES_USER"')"
DB_NAME="$(${COMPOSE[@]} run --rm --no-deps --entrypoint sh postgres -c 'printf %s "$POSTGRES_DB"')"

if [[ -z "$DB_USER" || -z "$DB_NAME" ]]; then
  echo "ERROR: Could not resolve POSTGRES_USER or POSTGRES_DB." >&2
  exit 1
fi

mkdir -p backups
BACKUP_FILE="backups/pre_org_schema_repair_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "==> Verifying PostgreSQL"
"${COMPOSE[@]}" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME"

echo "==> Creating backup: $BACKUP_FILE"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file is empty; refusing to modify the database." >&2
  exit 1
fi

echo "==> Validating backup archive"
gzip -t "$BACKUP_FILE"

restart_services() {
  if [[ "$SERVICES_STOPPED" == true ]]; then
    echo "==> Restarting app and collector"
    "${COMPOSE[@]}" up -d app collector >/dev/null
  fi
}
trap restart_services EXIT

echo "==> Stopping application database writers"
"${COMPOSE[@]}" stop app collector >/dev/null
SERVICES_STOPPED=true

echo "==> Repairing organization hierarchy columns"
"${COMPOSE[@]}" exec -T postgres \
  psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parentOrganizationId" TEXT;

ALTER TABLE "ParentOrganization"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "Department"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Organization_parentOrganizationId_fkey'
      AND conrelid = '"Organization"'::regclass
  ) THEN
    ALTER TABLE "Organization"
      ADD CONSTRAINT "Organization_parentOrganizationId_fkey"
      FOREIGN KEY ("parentOrganizationId")
      REFERENCES "ParentOrganization"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Organization_archivedAt_idx"
  ON "Organization"("archivedAt");

CREATE INDEX IF NOT EXISTS "Organization_parentOrganizationId_idx"
  ON "Organization"("parentOrganizationId");

CREATE INDEX IF NOT EXISTS "ParentOrganization_archivedAt_idx"
  ON "ParentOrganization"("archivedAt");

CREATE INDEX IF NOT EXISTS "Department_archivedAt_idx"
  ON "Department"("archivedAt");

COMMIT;
SQL

echo "==> Verifying repaired schema"
"${COMPOSE[@]}" exec -T postgres \
  psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  missing_columns integer;
  missing_indexes integer;
  missing_fk integer;
BEGIN
  SELECT count(*) INTO missing_columns
  FROM (
    VALUES
      ('Organization', 'description'),
      ('Organization', 'timezone'),
      ('Organization', 'archivedAt'),
      ('Organization', 'parentOrganizationId'),
      ('ParentOrganization', 'archivedAt'),
      ('Department', 'archivedAt')
  ) AS expected(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns actual
    WHERE actual.table_schema = 'public'
      AND actual.table_name = expected.table_name
      AND actual.column_name = expected.column_name
  );

  SELECT count(*) INTO missing_indexes
  FROM (
    VALUES
      ('Organization_archivedAt_idx'),
      ('Organization_parentOrganizationId_idx'),
      ('ParentOrganization_archivedAt_idx'),
      ('Department_archivedAt_idx')
  ) AS expected(index_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes actual
    WHERE actual.schemaname = 'public'
      AND actual.indexname = expected.index_name
  );

  SELECT count(*) INTO missing_fk
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Organization_parentOrganizationId_fkey'
      AND conrelid = '"Organization"'::regclass
      AND contype = 'f'
  );

  IF missing_columns > 0 OR missing_indexes > 0 OR missing_fk > 0 THEN
    RAISE EXCEPTION 'Schema verification failed: missing columns=%, indexes=%, foreign_keys=%',
      missing_columns, missing_indexes, missing_fk;
  END IF;
END
$$;
SQL

echo "==> Organization schema repair completed successfully"
