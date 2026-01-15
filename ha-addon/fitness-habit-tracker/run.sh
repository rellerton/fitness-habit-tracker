#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production

echo "==> Fitness Habit Tracker (HA add-on) starting"

cd /app

DB_URL=""
if [[ -f /data/options.json ]]; then
  DB_URL="$(grep -oE '"database_url"\s*:\s*"[^"]+"' /data/options.json \
    | sed -E 's/.*"database_url"\s*:\s*"([^"]+)".*/\1/' || true)"
fi

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

ADDON_NGINX_CONF="/app/ha-addon/nginx.conf"
if [[ ! -f "${ADDON_NGINX_CONF}" ]]; then
  echo "!! ERROR: nginx.conf not found at ${ADDON_NGINX_CONF}"
  echo "!! Dumping /app/ha-addon:"
  ls -la /app/ha-addon || true
  exit 1
fi

NGINX_TARGET=""
if [[ -d "/etc/nginx/http.d" ]]; then
  NGINX_TARGET="/etc/nginx/http.d/default.conf"
elif [[ -d "/etc/nginx/conf.d" ]]; then
  NGINX_TARGET="/etc/nginx/conf.d/default.conf"
else
  echo "!! ERROR: Could not find nginx include directory (/etc/nginx/http.d or /etc/nginx/conf.d)"
  ls -la /etc/nginx || true
  exit 1
fi

echo "==> Installing nginx config: ${ADDON_NGINX_CONF} -> ${NGINX_TARGET}"
cp -f "${ADDON_NGINX_CONF}" "${NGINX_TARGET}"

echo "==> nginx -t"
nginx -t

echo "==> starting Next.js (production) on :3001"
export PORT=3001
npx next start -p 3001 &

echo "==> starting nginx on :3000 (ingress)"
exec nginx -g "daemon off;"
