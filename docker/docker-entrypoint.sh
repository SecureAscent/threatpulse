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
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: Could not connect to database after 60s. Exiting."
    exit 1
  fi
  echo "   Database not ready yet, retrying in 2s... ($RETRIES attempts left)"
  sleep 2
done
echo "Database is ready"

cd /app/prisma-tools

# Database changes are deliberately opt-in. Normal application startup must not
# mutate a restored or production database. Run the app once with
# RUN_DB_MIGRATIONS=true during a controlled deployment or recovery.
if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying Prisma schema changes (non-destructive mode)..."
  npx prisma db push --schema=./prisma/schema.prisma --skip-generate

  if [ -f scripts/migrate-hierarchy.ts ]; then
    echo "Applying parent organization / organization / department backfill..."
    NODE_PATH=/app/prisma-tools/node_modules npx tsx scripts/migrate-hierarchy.ts
    echo "Organization hierarchy migration complete"
  fi
else
  echo "Skipping database migrations (RUN_DB_MIGRATIONS is not true)"
fi

# Demo seed data is also opt-in. It must never be inserted automatically into a
# recovered or production database.
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "Checking whether demo seed data is needed..."
  SEED_CHECK=$(NODE_PATH=/app/prisma-tools/node_modules node -e "
const { PrismaClient } = require('.prisma/client');
const p = new PrismaClient();
p.user.count().then(c => { console.log(c); return p.\$disconnect(); }).catch(() => { console.log('0'); return p.\$disconnect(); });
" 2>/dev/null || echo "0")

  if [ "$SEED_CHECK" = "0" ] || [ -z "$SEED_CHECK" ]; then
    echo "Seeding database with demo data..."
    NODE_PATH=/app/prisma-tools/node_modules npx tsx scripts/seed.ts
    echo "Database seeded successfully"
  else
    echo "Database already has $SEED_CHECK user(s), skipping demo seed"
  fi
else
  echo "Skipping demo seed data (SEED_DEMO_DATA is not true)"
fi

echo ""
echo "Starting ThreatPulse Intel on port ${PORT:-3000}"
echo "   URL: ${NEXTAUTH_URL:-http://localhost:3000}"
echo ""
cd /app
exec node server.js
