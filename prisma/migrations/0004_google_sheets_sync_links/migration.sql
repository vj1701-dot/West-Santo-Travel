CREATE TABLE "external_sync_links" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "external_key" TEXT NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
  "last_synced_at" TIMESTAMPTZ(6) NOT NULL,
  "last_payload_hash" TEXT,
  "source_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "external_sync_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_sync_links_provider_external_key_key"
  ON "external_sync_links"("provider", "external_key");

CREATE UNIQUE INDEX "external_sync_links_provider_itinerary_id_key"
  ON "external_sync_links"("provider", "itinerary_id");

CREATE INDEX "external_sync_links_provider_last_seen_at_idx"
  ON "external_sync_links"("provider", "last_seen_at");

ALTER TABLE "external_sync_links"
  ADD CONSTRAINT "external_sync_links_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
