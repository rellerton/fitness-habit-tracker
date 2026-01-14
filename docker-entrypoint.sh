#!/usr/bin/env sh
set -eu

echo "==> Fitness Habit Tracker: starting"
echo "==> NODE_ENV=${NODE_ENV:-}"

# If running as HA add-on, /data exists and is persistent.
# If running on Synology, you mapped /app/data.
if [ -d "/data" ]; then
  DATA_DIR="/data"
else
  DATA_DIR="/app/data"
fi

mkdir -p "$DATA_DIR"

# Prefer env var if valid, otherwise pull from HA options.json if present, otherwise default.
DB_URL="${DATABASE_URL:-}"

# If HA passed a literal placeholder, treat it as "unset"
case "${DB_URL}" in
  ""|*"%database_url%"*|*"\${database_url}"*)
    DB_URL=""
    ;;
esac

if [ -z "$DB_URL" ] && [ -f /data/options.json ]; then
  # Read database_url from options.json without jq
  DB_URL="$(grep -oE '"database_url"\s*:\s*"[^"]+"' /data/options.json \
    | sed -E 's/.*"database_url"\s*:\s*"([^"]+)".*/\1/' || true)"
fi

if [ -z "$DB_URL" ]; then
  DB_URL="file:${DATA_DIR}/dev.db"
fi

# Validate Prisma format
case "$DB_URL" in
  file:*)
    ;;
  *)
    echo "ERROR: DATABASE_URL must start with file:"
    echo "Got: $DB_URL"
    exit 1
    ;;
esac

export DATABASE_URL="$DB_URL"
export NODE_ENV="${NODE_ENV:-production}"

echo "==> DATABASE_URL=${DATABASE_URL}"
echo "==> DATA_DIR=${DATA_DIR}"

echo "==> prisma generate"
npx prisma generate

echo "==> prisma migrate deploy"
npx prisma migrate deploy

DB_PATH="${DATABASE_URL#file:}"
if [ ! -f "$DB_PATH" ]; then
  echo "==> No SQLite DB found at $DB_PATH yet. Seeding..."
  npx prisma db seed || true
fi

echo "==> Starting Next.js"
exec npm run start
