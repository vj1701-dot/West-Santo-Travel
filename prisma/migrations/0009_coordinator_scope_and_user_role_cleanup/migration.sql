UPDATE "User"
SET "role" = 'COORDINATOR'
WHERE "role" = 'PASSENGER';

UPDATE "AiQueryLog"
SET "roleSnapshot" = 'COORDINATOR'
WHERE "roleSnapshot" = 'PASSENGER';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COORDINATOR');

ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole"
  USING ("role"::text::"UserRole");

ALTER TABLE "AiQueryLog"
  ALTER COLUMN "roleSnapshot" TYPE "UserRole"
  USING ("roleSnapshot"::text::"UserRole");

DROP TYPE "UserRole_old";

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'COORDINATOR';

ALTER TABLE "ReminderRule"
  ADD COLUMN "airportScopeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "ReminderRule" AS rule
SET "airportScopeIds" = COALESCE((
  SELECT ARRAY_AGG(ca."airportId"::text ORDER BY ca."airportId"::text)
  FROM "CoordinatorAirport" AS ca
  WHERE ca."userId" = rule."createdByUserId"
), ARRAY[]::TEXT[])
WHERE EXISTS (
  SELECT 1
  FROM "User" AS user_record
  WHERE user_record."id" = rule."createdByUserId"
    AND user_record."role" = 'COORDINATOR'
);
