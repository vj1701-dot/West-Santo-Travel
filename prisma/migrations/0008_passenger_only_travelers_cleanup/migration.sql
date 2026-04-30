DROP INDEX IF EXISTS "users_legal_name_idx";

ALTER TABLE "passengers"
  DROP COLUMN IF EXISTS "email";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "legal_name",
  DROP COLUMN IF EXISTS "profile_type",
  DROP COLUMN IF EXISTS "notes";
