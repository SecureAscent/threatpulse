#!/usr/bin/env bash
###############################################################################
# ThreatPulse Intel — create a SUPERADMIN user
#
# Creates (or promotes) a SUPERADMIN user and its organization via Prisma,
# running inside the already-built `app` container.
#
# Values may be supplied as env vars or entered interactively:
#   EMAIL=admin@example.com PASSWORD='S3cret!' ORG_NAME='Acme Security' \
#     ./scripts/create-admin.sh
#
# Uses the production compose file and .env.prod by default; override with:
#   COMPOSE_FILE=docker-compose.dev.yml ENV_FILE=.env \
#     ./scripts/create-admin.sh
###############################################################################
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ -n "${ENV_FILE:-}" ]; then
  COMPOSE_ENV_FILE="$ENV_FILE"
elif [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
  COMPOSE_ENV_FILE=".env.prod"
else
  COMPOSE_ENV_FILE=".env"
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: Compose file '$COMPOSE_FILE' was not found." >&2
  exit 1
fi

if [ ! -f "$COMPOSE_ENV_FILE" ]; then
  echo "ERROR: Environment file '$COMPOSE_ENV_FILE' was not found." >&2
  echo "Create it first or set ENV_FILE=/path/to/your/env-file." >&2
  exit 1
fi

# Use an array so paths containing spaces are handled safely.
COMPOSE=(docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE")

# Validate Compose interpolation before prompting for credentials.
if ! "${COMPOSE[@]}" config --quiet; then
  echo "ERROR: Docker Compose configuration validation failed." >&2
  echo "Check required values in '$COMPOSE_ENV_FILE', including POSTGRES_PASSWORD." >&2
  exit 1
fi

# ── Gather inputs ────────────────────────────────────────────────────────────
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
ORG_NAME="${ORG_NAME:-}"

if [ -z "$EMAIL" ]; then
  read -r -p "Admin email: " EMAIL
fi
if [ -z "$PASSWORD" ]; then
  read -r -s -p "Admin password: " PASSWORD; echo
fi
if [ -z "$ORG_NAME" ]; then
  read -r -p "Organization name [ThreatPulse Demo]: " ORG_NAME
  ORG_NAME="${ORG_NAME:-ThreatPulse Demo}"
fi

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "ERROR: email and password are required." >&2
  exit 1
fi

# Derive a URL-friendly slug from the org name.
ORG_SLUG="$(echo "$ORG_NAME" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]\+/-/g' -e 's/^-//' -e 's/-$//')"
ORG_SLUG="${ORG_SLUG:-threatpulse-demo}"

echo "==> Using compose file '$COMPOSE_FILE' with environment '$COMPOSE_ENV_FILE'"
echo "==> Creating SUPERADMIN '$EMAIL' in org '$ORG_NAME' (slug: $ORG_SLUG)"

# ── Run the Prisma script inside the app container ───────────────────────────
# The app image ships @prisma/client + bcryptjs under /app/prisma-tools.
"${COMPOSE[@]}" exec -T \
  -e ADMIN_EMAIL="$EMAIL" \
  -e ADMIN_PASSWORD="$PASSWORD" \
  -e ADMIN_ORG="$ORG_NAME" \
  -e ADMIN_ORG_SLUG="$ORG_SLUG" \
  app sh -c 'cd /app/prisma-tools && NODE_PATH=/app/prisma-tools/node_modules node' <<'NODE'
const { PrismaClient } = require('.prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const orgName = process.env.ADMIN_ORG;
  const orgSlug = process.env.ADMIN_ORG_SLUG;

  try {
    const org = await prisma.organization.upsert({
      where: { slug: orgSlug },
      update: { name: orgName },
      create: { name: orgName, slug: orgSlug },
    });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hashed, role: 'SUPERADMIN', organizationId: org.id },
      create: {
        email,
        name: 'Super Admin',
        password: hashed,
        role: 'SUPERADMIN',
        organizationId: org.id,
      },
    });

    console.log('SUCCESS: SUPERADMIN ready ->', user.email, '(org:', org.name + ')');
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
NODE

echo "==> Done."
