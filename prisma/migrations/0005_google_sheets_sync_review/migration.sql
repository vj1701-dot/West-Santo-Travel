CREATE TYPE "ExternalSyncStatus" AS ENUM ('IN_SYNC', 'REVIEW_REQUIRED');

ALTER TABLE "ExternalSyncLink"
ADD COLUMN "syncStatus" "ExternalSyncStatus" NOT NULL DEFAULT 'IN_SYNC',
ADD COLUMN "pendingRosterDiff" JSONB,
ADD COLUMN "lastReviewDiffAt" TIMESTAMPTZ(6);
