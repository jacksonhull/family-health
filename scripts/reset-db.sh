#!/bin/sh
# Reset the database: drops all tables, re-applies the schema, re-seeds.
# Safe to run while the dev containers are running — the app will reconnect.
#
# Usage (from repo root):
#   ./scripts/reset-db.sh
#
# Or via npm:
#   npm run db:reset

set -e

echo "[db:reset] Dropping and recreating schema..."
npx prisma db push --force-reset

echo "[db:reset] Seeding..."
npx prisma db seed

echo "[db:reset] Done."
