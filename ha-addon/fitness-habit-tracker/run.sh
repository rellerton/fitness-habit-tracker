#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production

echo "==> Fitness Habit Tracker (HA add-on) starting"

# Always run from app directory
cd /app

# Pull DB URL from HA options.json if present
DB_URL=""
if [[ -f /data/options.json ]]; then
  DB_URL="$(grep -oE '"database_url"\s*:\s*"[^"]+"' /data/options.json \
    | sed -E 's/.*"database_url"\s*:\s*"([^"]+)".*/\1/' || true)"
fi

# Fallback
if [[ -z "${DB_URL}" ]]; then
  DB_URL="file:/data/dev.db"
fi

export DATABASE_URL="${DB_URL}"

echo "==> NODE_ENV=${NODE_ENV}"
echo "==> DATABASE_URL=${DATABASE_URL}"

mkdir -p /data

echo "==> prisma generate"
npx prisma generate

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> starting Next.js on :3001"
PORT=3001 npm run start &

echo "==> starting nginx on :3000 (ingress)"
exec nginx -g "daemon off;"
