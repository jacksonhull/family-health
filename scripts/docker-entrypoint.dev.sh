#!/bin/sh
set -e

# Regenerate Prisma client in case schema changed since the image was built.
# This writes into node_modules inside the container (not the host).
echo "[dev] Generating Prisma client..."
npx prisma generate

# Push schema to DB — preserves existing data (no --force-reset).
echo "[dev] Pushing database schema..."
npx prisma db push

# Seed is idempotent: creates admin + default medical history only if absent.
echo "[dev] Seeding (skipped if already seeded)..."
npx prisma db seed || true

echo "[dev] Starting Next.js dev server..."
exec npm run dev
