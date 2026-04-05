#!/bin/sh
set -e

echo "Pushing database schema..."
npx prisma db push --accept-data-loss

echo "Seeding admin user..."
npx prisma db seed

echo "Starting Next.js server..."
exec node server.js
