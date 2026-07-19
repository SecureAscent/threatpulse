#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

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

echo "==> Stopping application database writers"
"${COMPOSE[@]}" stop app collector >/dev/null

restart_services() {
  echo "==> Restarting app and collector"
  "${COMPOSE[@]}" up -d app collector >/dev/null
}
trap restart_services EXIT

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

COMMIT;

CREATE INDEX IF NOT EXISTS "Organization_archivedAt_idx"
  ON "Organization"("archivedAt");

CREATE INDEX IF NOT EXISTS "Organization_parentOrganizationId_idx"
  ON "Organization"("parentOrganizationId");

CREATE INDEX IF NOT EXISTS "ParentOrganization_archivedAt_idx"
  ON "ParentOrganization"("archivedAt");

CREATE INDEX IF NOT EXISTS "Department_archivedAt_idx"
  ON "Department"("archivedAt");
SQL

echo "==> Verifying repaired columns"
"${COMPOSE[@]}" exec -T postgres \
  psql -X -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c '
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = '\''public'\''
  AND (
    (table_name = '\''Organization'\'' AND column_name IN ('\''description'\'', '\''timezone'\'', '\''archivedAt'\'', '\''parentOrganizationId'\''))
    OR (table_name = '\''ParentOrganization'\'' AND column_name = '\''archivedAt'\'')
    OR (table_name = '\''Department'\'' AND column_name = '\''archivedAt'\'')
  )
ORDER BY table_name, column_name;'

echo "==> Organization schema repair completed successfully"