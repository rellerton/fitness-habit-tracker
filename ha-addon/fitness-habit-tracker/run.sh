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

mkdir -p /data

echo "==> prisma migrate deploy"
npx prisma migrate deploy

# Sanity check: nginx config must exist where Dockerfile copied it
NGINX_CONF="/etc/nginx/http.d/default.conf"
if [[ ! -f "${NGINX_CONF}" ]]; then
  echo "!! ERROR: nginx default.conf not found at ${NGINX_CONF}"
  echo "!! Dumping /etc/nginx:"
  ls -la /etc/nginx || true
  echo "!! Dumping /etc/nginx/http.d:"
  ls -la /etc/nginx/http.d || true
  exit 1
fi

echo "==> nginx -t"
nginx -t

echo "==> starting Next.js on :3001"
PORT=3001 npm run start &
NEXT_PID=$!

echo "==> starting nginx on :3000 (ingress)"
nginx -g "daemon off;" &
NGINX_PID=$!

shutdown() {
  trap - EXIT INT TERM
  kill -TERM "${NEXT_PID}" "${NGINX_PID}" 2>/dev/null || true
  wait "${NEXT_PID}" "${NGINX_PID}" 2>/dev/null || true
}

trap shutdown EXIT INT TERM

set +e
wait -n "${NEXT_PID}" "${NGINX_PID}"
EXITED_STATUS=$?
set -e

if ! kill -0 "${NEXT_PID}" 2>/dev/null; then
  EXITED_PROCESS="Next.js"
else
  EXITED_PROCESS="Nginx"
fi

echo "!! ${EXITED_PROCESS} exited with status ${EXITED_STATUS}; stopping add-on"
exit 1
