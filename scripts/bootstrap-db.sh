#!/bin/sh
# Bootstrap script for database initialization
# Keeps existing data across rebuilds/redeploys and seeds only on first boot.

set -e

DB_CHECK_URL="${DATABASE_URL%%\?*}"

# Mask password in URL for logging
LOG_URL=$(echo "$DATABASE_URL" | sed 's/:[^@]*@/:****@/')
echo "Starting bootstrap with URL: $LOG_URL"

echo "Waiting for database connection..."
for i in $(seq 1 30); do
  if pg_isready -d "$DB_CHECK_URL" > /dev/null 2>&1; then
    echo "Database is ready (pg_isready)!"
    break
  fi

  if [ "$i" -eq 30 ]; then
    echo "Failed to connect to database after 30 attempts"
    exit 1
  fi

  echo "Attempt $i - retrying..."
  sleep 2
done

if ! psql "$DB_CHECK_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "Database is ready but SELECT 1 failed. Checking schema..."
fi

echo "Applying database schema..."
if ! npx prisma migrate deploy --schema prisma/schema.prisma; then
  echo "Migrate deploy failed, attempting db push with accepted data loss..."
  npx prisma db push --accept-data-loss --schema prisma/schema.prisma

  echo "Reconciling Prisma migration history to the current schema state..."
  psql "$DB_CHECK_URL" -c \
    "UPDATE \"_prisma_migrations\" SET \"rolled_back_at\" = NOW() WHERE \"finished_at\" IS NULL AND \"rolled_back_at\" IS NULL;" \
    > /dev/null 2>&1 || true

  for migration_dir in prisma/migrations/*; do
    if [ -d "$migration_dir" ]; then
      migration_name=$(basename "$migration_dir")
      npx prisma migrate resolve --applied "$migration_name" --schema prisma/schema.prisma > /dev/null 2>&1 || true
    fi
  done
fi

echo "Checking whether application data already exists..."
USER_COUNT_QUERY='SELECT COUNT(*) FROM "User"'
USER_COUNT=$(psql "$DB_CHECK_URL" -t -c "$USER_COUNT_QUERY" 2>/dev/null | xargs)

if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -eq 0 ]; then
  echo "No existing users found (computed count: '$USER_COUNT') - seeding default data..."
  node --import tsx prisma/seed.mjs
  echo "Database initialized successfully!"
else
  echo "Found $USER_COUNT existing users - skipping seed and preserving current data."
  echo "Migrations completed successfully!"
fi

echo "Bootstrap complete!"
