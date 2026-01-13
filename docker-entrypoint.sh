#!/usr/bin/env sh
set -eu

echo "==> Fitness Habit Tracker: starting"
echo "==> NODE_ENV=${NODE_ENV:-}"
echo "==> DATABASE_URL=${DATABASE_URL:-}"

# Ensure the persistent data dir exists
mkdir -p /app/data

# Prisma generate (kept because you're using npx in runtime image)
echo "==> prisma generate"
npx prisma generate

# Apply migrations (safe repeatedly)
echo "==> prisma migrate deploy"
npx prisma migrate deploy

# Seed only if DB file doesn't exist yet
if [ ! -f "/app/data/dev.db" ]; then
  echo "==> No SQLite DB found at /app/data/dev.db yet. Seeding..."
  npx prisma db seed || true
fi

echo "==> Starting Next.js"
exec npm run start
