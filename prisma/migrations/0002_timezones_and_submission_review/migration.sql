ALTER TABLE "airports" ADD COLUMN "time_zone" TEXT NOT NULL DEFAULT 'America/Los_Angeles';

ALTER TABLE "flight_segments"
  ADD COLUMN "departure_time_zone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN "arrival_time_zone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN "departure_time_utc" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  ADD COLUMN "arrival_time_utc" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();

ALTER TABLE "transport_tasks"
  ADD COLUMN "scheduled_time_utc" TIMESTAMPTZ(6);

CREATE TABLE "transport_task_location_pings" (
  "id" UUID NOT NULL,
  "transport_task_id" UUID NOT NULL,
  "driver_id" UUID NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "transport_task_location_pings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transport_task_location_pings_transport_task_id_recorded_at_idx"
  ON "transport_task_location_pings"("transport_task_id", "recorded_at");

ALTER TABLE "transport_task_location_pings"
  ADD CONSTRAINT "transport_task_location_pings_transport_task_id_fkey"
  FOREIGN KEY ("transport_task_id") REFERENCES "transport_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transport_task_location_pings"
  ADD CONSTRAINT "transport_task_location_pings_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
