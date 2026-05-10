CREATE TYPE "OptInRole" AS ENUM ('PASSENGER', 'DRIVER');

CREATE TABLE "PublicOptIn" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "OptInRole" NOT NULL,
    "consentText" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passengerId" UUID,
    "driverId" UUID,

    CONSTRAINT "PublicOptIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicOptIn_phone_role_submittedAt_idx" ON "PublicOptIn"("phone", "role", "submittedAt");
CREATE INDEX "PublicOptIn_passengerId_idx" ON "PublicOptIn"("passengerId");
CREATE INDEX "PublicOptIn_driverId_idx" ON "PublicOptIn"("driverId");

ALTER TABLE "PublicOptIn"
    ADD CONSTRAINT "PublicOptIn_passengerId_fkey"
    FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicOptIn"
    ADD CONSTRAINT "PublicOptIn_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
