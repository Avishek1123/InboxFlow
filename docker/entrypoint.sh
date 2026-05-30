#!/bin/sh
set -e

# Set MIGRATE_ON_START=true to run migrations before boot (prod image)
if [ "$MIGRATE_ON_START" = "true" ] && [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  node node_modules/prisma/build/index.js migrate deploy 2>/dev/null || \
    npx prisma migrate deploy
fi

echo "Starting InboxFlow AI..."
exec "$@"
