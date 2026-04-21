#!/bin/sh
# Bootstrap script for database initialization
# Checks if data exists before running migrations or seeding

set -e

DATABASE_URL="${DATABASE_URL}"

echo "Waiting for database connection..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo "Database is ready!"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "Failed to connect to database after 10 attempts"
    exit 1
  fi
  echo "Attempt $i - retrying..."
  sleep 2
done

# Check if any tables exist with data
echo "Checking if database has existing data..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")

if [ "$TABLE_COUNT" -eq 0 ]; then
  echo "No tables found - running full initialization (migrations + build + seed)..."
  
  # Run initial schema creation
  npx prisma migrate deploy --schema prisma/schema.prisma || \
  npx prisma db push --accept-data-loss --schema prisma/schema.prisma
  
  # Build packages
  echo "Building packages..."
  npm run build --workspace packages/core
  npm run build --workspace packages/data
  
  # Seed the database
  echo "Seeding database..."
  node --import tsx prisma/seed.mjs
  
  echo "✓ Database initialized successfully!"
else
  echo "Found existing tables - running migrations only..."
  
  # Only run migrations on existing database
  npx prisma migrate deploy --schema prisma/schema.prisma || {
    echo "No pending migrations"
  }
  
  echo "✓ Migrations completed successfully!"
fi

echo "Bootstrap complete!"
