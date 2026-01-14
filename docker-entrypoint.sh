#!/usr/bin/env sh
set -eu

echo "==> Fitness Habit Tracker: starting"
echo "==> NODE_ENV=${NODE_ENV:-}"
echo "==> DATABASE_URL=${DATABASE_URL:-}"

# Default for backwards compatibility (Synology)
: "${DATABASE_URL:=file:/app/data/dev.db}"
export DATABASE_URL

# Derive the sqlite file path from DATABASE_URL (supports file:/path and file:./relative)
db_url="$DATABASE_URL"
db_path="${db_url#file:}"

# If path is relative (no leading /), resolve relative to /app
case "$db_path" in
  /*) : ;;
  *) db_path="/app/$db_path" ;;
esac

db_dir="$(dirname "$db_path")"
db_file="$db_path"

echo "==> Resolved DB file: $db_file"
echo "==> Ensuring DB dir exists: $db_dir"
mkdir -p "$db_dir"

# Prisma generate (kept because you're using npx in runtime image)
echo "==> prisma generate"
npx prisma generate

# Apply migrations (safe repeatedly)
echo "==> prisma migrate deploy"
npx prisma migrate deploy

# Seed only if DB file doesn't exist yet
if [ ! -f "$db_file" ]; then
  echo "==> No SQLite DB found at $db_file yet. Seeding..."
  npx prisma db seed || true
fi

echo "==> Starting Next.js"
exec npm run start
