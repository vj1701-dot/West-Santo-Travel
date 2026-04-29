ALTER TABLE "users"
  ADD COLUMN "legal_name" TEXT,
  ADD COLUMN "notes" TEXT;

CREATE INDEX "users_legal_name_idx" ON "users"("legal_name");
