ALTER TYPE "ReminderChannel" ADD VALUE IF NOT EXISTS 'SMS';

CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM', 'SMS', 'INTERNAL');

ALTER TABLE "itineraries"
  ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "itineraries_is_archived_idx" ON "itineraries"("is_archived");

ALTER TABLE "notification_logs"
  ADD COLUMN "delivery_channel" "NotificationChannel" NOT NULL DEFAULT 'TELEGRAM',
  ADD COLUMN "recipient_phone" TEXT,
  ADD COLUMN "provider_name" TEXT,
  ADD COLUMN "provider_message_id" TEXT,
  ADD COLUMN "dedupe_key" TEXT;

CREATE UNIQUE INDEX "notification_logs_dedupe_key_key"
  ON "notification_logs"("dedupe_key");

CREATE INDEX "notification_logs_delivery_channel_status_idx"
  ON "notification_logs"("delivery_channel", "status");
