#!/usr/bin/env sh
set -eu

echo "==> Fitness Habit Tracker (HA add-on) starting"
echo "==> NODE_ENV=${NODE_ENV:-}"
echo "==> DATABASE_URL=${DATABASE_URL:-}"

# DATABASE_URL must exist and must be file:
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

case "$DATABASE_URL" in
  file:*)
    ;;
  *)
    echo "ERROR: DATABASE_URL must start with file:"
    exit 1
    ;;
esac

# Resolve DB path and directory
DB_PATH="${DATABASE_URL#file:}"
DB_DIR="$(dirname "$DB_PATH")"

echo "==> Resolved DB file: $DB_PATH"
echo "==> Ensuring DB dir exists: $DB_DIR"
mkdir -p "$DB_DIR"

echo "==> prisma generate"
npx prisma generate

echo "==> prisma migrate deploy"
npx prisma migrate deploy

# Optional seed (only if DB file does not exist yet)
if [ ! -f "$DB_PATH" ]; then
  echo "==> No DB found, seeding..."
  npx prisma db seed || true
fi

echo "==> Starting Next.js"
exec npm run start
