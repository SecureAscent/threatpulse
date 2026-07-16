###############################################################################
# ThreatPulse Intelligence Collector
# Multi-stage build: deps -> build (tsc) -> production (node)
###############################################################################

# -- Dependencies ------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json ./
# Install without a frozen lockfile (lockfile is generated on first build).
RUN npm install --no-audit --no-fund

# -- Build -------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY package.json ./
COPY src ./src
RUN npm run build

# -- Production --------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 collector

# Install production-only dependencies.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Compiled output.
COPY --from=builder /app/dist ./dist

RUN chown -R collector:nodejs /app
USER collector

# Liveness signal for `docker inspect` (process presence check).
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
    CMD pgrep -f "node" > /dev/null || exit 1

CMD ["node", "dist/index.js"]
