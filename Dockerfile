# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: Base — shared settings for all stages
# ============================================================
FROM node:22-alpine AS base
WORKDIR /usr/src/app
# Prisma's query-engine needs openssl; argon2 needs build tools in deps stage
RUN apk add --no-cache openssl

# ============================================================
# Stage 2: Dependencies — install everything for the build
# ============================================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
# Stage 3: Builder — generate Prisma client & compile TypeScript
# ============================================================
FROM base AS builder
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build NestJS application
RUN npm run build

# Prune devDependencies for production
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Re-generate Prisma client in pruned node_modules
RUN npx prisma generate

# ============================================================
# Stage 4: Production — minimal runtime image
# ============================================================
FROM node:22-alpine AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Copy only what's needed to run
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /usr/src/app/prisma ./prisma

# Run as non-root user (built into official node images)
USER node

EXPOSE 3000

# Healthcheck against the liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
