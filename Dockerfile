# syntax=docker/dockerfile:1

# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache openssl && npm install -g npm@latest

COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma

# Use npm install on first build (no lockfile yet); once package-lock.json is
# committed, this will switch automatically to a reproducible install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN npx prisma generate

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl && npm install -g npm@latest

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output (bundles only what the app needs at runtime)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# node_modules for the entrypoint (prisma CLI, tsx, seed script deps)
# We copy the full node_modules from the builder so the entrypoint scripts work
COPY --from=builder /app/node_modules ./node_modules

# Prisma schema and seed script
COPY --from=builder /app/prisma ./prisma

# Entrypoint
COPY scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
