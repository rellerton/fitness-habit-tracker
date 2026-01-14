#!/usr/bin/env bash
set -euo pipefail

# HA add-ons persist data here
mkdir -p /data

# If user didn't override it, use options value or default
DB_URL="${DATABASE_URL:-}"

# If DATABASE_URL isn't provided via env, try options.json (HA convention)
if [[ -z "${DB_URL}" && -f /data/options.json ]]; then
  # crude parse without jq; safe enough for a single key
  DB_URL="$(grep -oE '"database_url"\s*:\s*"[^"]+"' /data/options.json | sed -E 's/.*"database_url"\s*:\s*"([^"]+)".*/\1/')"
fi

# fallback
if [[ -z "${DB_URL}" ]]; then
  DB_URL="file:/data/dev.db"
fi

export DATABASE_URL="${DB_URL}"
export NODE_ENV=production

echo "==> Fitness Habit Tracker (HA add-on) starting"
echo "==> NODE_ENV=${NODE_ENV}"
echo "==> DATABASE_URL=${DATABASE_URL}"

echo "==> prisma generate"
npx prisma generate

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> starting Next.js"
exec npm run start
