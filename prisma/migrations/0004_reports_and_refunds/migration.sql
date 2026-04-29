ALTER TABLE "users"
  ADD COLUMN "exclude_from_coordinator_messages" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "refund_events" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "refunded_at" DATE NOT NULL,
  "note" TEXT,
  "recorded_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refund_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_allocations" (
  "id" UUID NOT NULL,
  "refund_event_id" UUID NOT NULL,
  "booking_allocation_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refund_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refund_events_itinerary_id_refunded_at_idx" ON "refund_events"("itinerary_id", "refunded_at");
CREATE INDEX "refund_events_booking_id_idx" ON "refund_events"("booking_id");
CREATE INDEX "refund_events_recorded_by_user_id_idx" ON "refund_events"("recorded_by_user_id");
CREATE UNIQUE INDEX "refund_allocations_refund_event_id_booking_allocation_id_key" ON "refund_allocations"("refund_event_id", "booking_allocation_id");
CREATE INDEX "refund_allocations_booking_allocation_id_idx" ON "refund_allocations"("booking_allocation_id");

ALTER TABLE "refund_events"
  ADD CONSTRAINT "refund_events_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refund_events"
  ADD CONSTRAINT "refund_events_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refund_events"
  ADD CONSTRAINT "refund_events_recorded_by_user_id_fkey"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "refund_allocations"
  ADD CONSTRAINT "refund_allocations_refund_event_id_fkey"
  FOREIGN KEY ("refund_event_id") REFERENCES "refund_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refund_allocations"
  ADD CONSTRAINT "refund_allocations_booking_allocation_id_fkey"
  FOREIGN KEY ("booking_allocation_id") REFERENCES "booking_allocations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
