###############################################################################
# ThreatPulse Intel - Docker Build
# Multi-stage: deps -> build -> production (standalone)
###############################################################################

# -- Base --------------------------------------------------------------------
FROM node:22-alpine AS base
# wget (busybox) is used by the container HEALTHCHECK; netcat by the entrypoint
RUN apk add --no-cache libc6-compat openssl wget netcat-openbsd && \
    corepack enable && \
    corepack prepare yarn@4.9.2 --activate

# -- Install dependencies ----------------------------------------------------
FROM base AS deps
WORKDIR /app

# Use the repository's Yarn Berry lockfile with an explicit node_modules linker.
COPY nextjs_space/package.json ./package.json
COPY nextjs_space/yarn.lock ./yarn.lock
COPY nextjs_space/.yarnrc.yml ./.yarnrc.yml
RUN yarn install --immutable

# -- Build -------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY nextjs_space/ .

# Fix Prisma output path for Docker context (schema references absolute dev path)
RUN sed -i 's|output.*=.*"/home/ubuntu.*"|output = "./node_modules/.prisma/client"|' prisma/schema.prisma

# The app's next.config pins outputFileTracingRoot to the PARENT dir (needed for
# the original monorepo layout). In Docker the app is self-contained at /app, so
# a parent tracing root nests the standalone build under an "app/" subfolder and
# server.js ends up at .next/standalone/app/server.js. Pin the tracing root to
# /app itself so server.js lands at .next/standalone/server.js as expected.
RUN sed -i "s|outputFileTracingRoot: path.join(__dirname, '../'),|outputFileTracingRoot: __dirname,|" next.config.js

# Generate Prisma client
RUN npx prisma generate

# Build Next.js in standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_OUTPUT_MODE=standalone

# ── Build args (bake public config into the client bundle at build time) ─────
# NEXT_PUBLIC_* values are inlined into the browser bundle by Next.js, so they
# MUST be present during `yarn build`. Pass them via docker-compose build args.
ARG NEXTAUTH_URL="http://localhost:3000"
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_APP_NAME="ThreatPulse Intel"

ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}

# Dummy secrets needed only to satisfy the build (never used at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="build-time-placeholder"

RUN yarn build

# -- Production --------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone server output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma assets for runtime migrations + seeding
RUN mkdir -p /app/prisma-tools/node_modules
COPY --from=builder /app/prisma /app/prisma-tools/prisma
COPY --from=builder /app/scripts /app/prisma-tools/scripts
COPY --from=builder /app/tsconfig.json /app/prisma-tools/tsconfig.json
COPY --from=builder /app/package.json /app/prisma-tools/package.json
COPY --from=builder /app/node_modules/.prisma /app/prisma-tools/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/prisma-tools/node_modules/@prisma
COPY --from=builder /app/node_modules/prisma /app/prisma-tools/node_modules/prisma

# tsx and its dependencies for running seed.ts
COPY --from=builder /app/node_modules/tsx /app/prisma-tools/node_modules/tsx
COPY --from=builder /app/node_modules/esbuild /app/prisma-tools/node_modules/esbuild
COPY --from=builder /app/node_modules/get-tsconfig /app/prisma-tools/node_modules/get-tsconfig
COPY --from=builder /app/node_modules/resolve-pkg-maps /app/prisma-tools/node_modules/resolve-pkg-maps
COPY --from=builder /app/node_modules/bcryptjs /app/prisma-tools/node_modules/bcryptjs

# Create .bin links for npx to find prisma and tsx
RUN mkdir -p /app/prisma-tools/node_modules/.bin && \
    ln -sf ../prisma/build/index.js /app/prisma-tools/node_modules/.bin/prisma && \
    ln -sf ../tsx/dist/cli.mjs /app/prisma-tools/node_modules/.bin/tsx

# Set Prisma schema path for CLI commands
ENV PRISMA_SCHEMA_PATH=/app/prisma-tools/prisma/schema.prisma

# Copy entrypoint script
COPY docker/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# The entrypoint needs write access (prisma needs to write temp files)
RUN chown -R nextjs:nodejs /app/prisma-tools

USER nextjs
EXPOSE 3000

# ── Health check ────────────────────────────────────────────────────────────
# /login is a public 200 page (no auth/DB round-trip required to render).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/login || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]