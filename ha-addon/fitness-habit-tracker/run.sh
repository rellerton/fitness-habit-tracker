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

# -------------------------------------------------------------------
# NGINX CONFIG INSTALL
# HA add-on nginx images typically include /etc/nginx/http.d/*.conf (Alpine)
# or /etc/nginx/conf.d/*.conf (Debian/Ubuntu).
# Your addon provides /app/ha-addon/nginx.conf (or /app/nginx.conf depending on copy).
# We place it into the correct include file (default.conf).
# -------------------------------------------------------------------

# Where is the addon nginx.conf in the container?
ADDON_NGINX_CONF=""
if [[ -f "/app/ha-addon/nginx.conf" ]]; then
  ADDON_NGINX_CONF="/app/ha-addon/nginx.conf"
elif [[ -f "/app/nginx.conf" ]]; then
  ADDON_NGINX_CONF="/app/nginx.conf"
else
  echo "!! ERROR: Could not find addon nginx.conf at /app/ha-addon/nginx.conf or /app/nginx.conf"
  echo "!! Your Dockerfile must COPY nginx.conf into the image."
  exit 1
fi

# Decide target include path
NGINX_TARGET=""
if [[ -d "/etc/nginx/http.d" ]]; then
  NGINX_TARGET="/etc/nginx/http.d/default.conf"
elif [[ -d "/etc/nginx/conf.d" ]]; then
  NGINX_TARGET="/etc/nginx/conf.d/default.conf"
else
  echo "!! ERROR: Could not find nginx include directory (/etc/nginx/http.d or /etc/nginx/conf.d)"
  echo "!! Dumping /etc/nginx for debugging:"
  ls -la /etc/nginx || true
  exit 1
fi

echo "==> Installing nginx config: ${ADDON_NGINX_CONF} -> ${NGINX_TARGET}"
cp -f "${ADDON_NGINX_CONF}" "${NGINX_TARGET}"

echo "==> nginx -t"
nginx -t

# -------------------------------------------------------------------
# START SERVICES
# IMPORTANT: do NOT use dev mode behind ingress.
# Force production start explicitly with next start.
# -------------------------------------------------------------------

echo "==> starting Next.js (production) on :3001"
export PORT=3001

# Force Next production server directly (bypasses any "start" script surprises)
npx next start -p 3001 &

echo "==> starting nginx on :3000 (ingress)"
exec nginx -g "daemon off;"
