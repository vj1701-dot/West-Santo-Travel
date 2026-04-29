CREATE TYPE "ProfileType" AS ENUM ('WEST_SANTO', 'GUEST_SANTO', 'HARIBHAKTO');

ALTER TABLE "users"
  ADD COLUMN "profile_type" "ProfileType";

ALTER TABLE "drivers"
  ADD COLUMN "profile_type" "ProfileType";
