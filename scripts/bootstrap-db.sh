#!/bin/sh
# Bootstrap script for database initialization
# Checks if data exists before running migrations or seeding

set -e

# Mask password in URL for logging
LOG_URL=$(echo $DATABASE_URL | sed 's/:[^@]*@/:****@/')
echo "Starting bootstrap with URL: $LOG_URL"

echo "Waiting for database connection..."
# Use pg_isready for the wait loop as it's more reliable for initial connectivity checks
for i in $(seq 1 30); do
  if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
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

# Try one SELECT 1 to be absolutely sure
if ! psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "Database is ready but SELECT 1 failed. Checking schema..."
fi

# Check if any tables exist with data
echo "Checking if database has existing data..."
# Run query and capture output
QUERY="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "$QUERY" 2>/dev/null | xargs)

if [ -z "$TABLE_COUNT" ] || [ "$TABLE_COUNT" -eq 0 ]; then
  echo "No tables found (computed count: '$TABLE_COUNT') - running full initialization..."
  
  # Run initial schema creation
  npx prisma migrate deploy --schema prisma/schema.prisma || \
  npx prisma db push --accept-data-loss --schema prisma/schema.prisma
  
  # Build packages (required for seeding if seeds use internal packages)
  echo "Building packages..."
  npm run build --workspace packages/core
  npm run build --workspace packages/data
  
  # Seed the database
  echo "Seeding database..."
  node --import tsx prisma/seed.mjs
  
  echo "✓ Database initialized successfully!"
else
  echo "Found $TABLE_COUNT existing tables - running migrations only..."
  
  # Only run migrations on existing database
  npx prisma migrate deploy --schema prisma/schema.prisma || {
    echo "No pending migrations or migrate deploy failed, attempting db push..."
    npx prisma db push --schema prisma/schema.prisma
  }
  
  echo "✓ Migrations completed successfully!"
fi

echo "Bootstrap complete!"
