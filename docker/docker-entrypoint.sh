#!/bin/sh
set -e

echo "=============================================="
echo "       ThreatPulse Intel -- Starting          "
echo "=============================================="

DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
RETRIES=30
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "ERROR: Could not connect to database after 60s. Exiting."
    exit 1
  fi
  echo "   Database not ready yet, retrying in 2s... ($RETRIES attempts left)"
  sleep 2
done
echo "Database is ready"

# Older ThreatPulse versions treated threatId as globally unique. Before adding
# the tenant-scoped compound unique constraint, remove only duplicate records
# that share the same organizationId and threatId. The newest row is retained.
echo "Checking for duplicate tenant threat records..."
cd /app/prisma-tools
NODE_PATH=/app/prisma-tools/node_modules node <<'NODE'
const { PrismaClient } = require('.prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tableExists = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public."Threat"') AS table_name
  `);

  if (!tableExists?.[0]?.table_name) {
    console.log('Threat table does not exist yet; skipping duplicate cleanup');
    return;
  }

  const columnExists = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Threat'
      AND column_name = 'organizationId'
    LIMIT 1
  `);

  if (!columnExists.length) {
    console.log('organizationId column does not exist yet; skipping duplicate cleanup');
    return;
  }

  const removed = await prisma.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT
        "id",
        ROW_NUMBER() OVER (
          PARTITION BY "organizationId", "threatId"
          ORDER BY "lastUpdated" DESC NULLS LAST, "dateAdded" DESC NULLS LAST, "id" ASC
        ) AS row_number
      FROM "Threat"
      WHERE "organizationId" IS NOT NULL
    )
    DELETE FROM "Threat" AS threat
    USING ranked
    WHERE threat."id" = ranked."id"
      AND ranked.row_number > 1
  `);

  console.log(`Duplicate cleanup complete; removed ${removed} duplicate threat record(s)`);
}

main()
  .catch((error) => {
    console.error('Duplicate threat cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE

echo "Pushing database schema..."
npx prisma db push --schema=./prisma/schema.prisma --skip-generate 2>&1 || {
  echo "Schema push failed, retrying with accept-data-loss..."
  npx prisma db push --schema=./prisma/schema.prisma --skip-generate --accept-data-loss 2>&1
}
echo "Database schema is up to date"

if [ -f /app/prisma-tools/scripts/migrate-hierarchy.ts ]; then
  echo "Applying organization hierarchy migration..."
  NODE_PATH=/app/prisma-tools/node_modules npx tsx scripts/migrate-hierarchy.ts 2>&1
  echo "Organization hierarchy migration complete"
fi

echo "Checking if seed data exists..."
SEED_CHECK=$(cd /app/prisma-tools && NODE_PATH=/app/prisma-tools/node_modules node -e "
const { PrismaClient } = require('.prisma/client');
const p = new PrismaClient();
p.user.count().then(c => { console.log(c); return p.\$disconnect(); }).catch(() => { console.log('0'); return p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$SEED_CHECK" = "0" ] || [ -z "$SEED_CHECK" ]; then
  echo "Seeding database with demo data..."
  cd /app/prisma-tools
  NODE_PATH=/app/prisma-tools/node_modules npx tsx scripts/seed.ts 2>&1
  echo "Database seeded successfully"
  echo ""
  echo "   Demo accounts created:"
  echo "   Admin:   admin@threatpulse.com / admin123!"
  echo "   Analyst: analyst@threatpulse.com / analyst123!"
else
  echo "Database already has $SEED_CHECK user(s), skipping seed"
fi

echo ""
echo "Starting ThreatPulse Intel on port ${PORT:-3000}"
echo "   URL: ${NEXTAUTH_URL:-http://localhost:3000}"
echo ""
cd /app
exec node server.js
