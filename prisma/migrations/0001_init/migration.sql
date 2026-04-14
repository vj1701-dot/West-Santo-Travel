-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COORDINATOR', 'PASSENGER');

-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('WEST_SANTO', 'GUEST_SANTO', 'HARIBHAKTO', 'EXTRA_SEAT');

-- CreateEnum
CREATE TYPE "ItineraryStatus" AS ENUM ('CREATED', 'CONFIRMED', 'PENDING_APPROVAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportTaskType" AS ENUM ('PICKUP', 'DROPOFF');

-- CreateEnum
CREATE TYPE "TransportTaskStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'EN_ROUTE', 'PICKED_UP', 'DROPPED_OFF', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE_FLAGGED');

-- CreateEnum
CREATE TYPE "DuplicateRule" AS ENUM ('PASSENGER_FLIGHT_DATE', 'BOOKING_CONFIRMATION_TRAVELER', 'LEGAL_NAME_ROUTE_CLOSE_TIME');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('WEB', 'BOT', 'SYSTEM', 'IMPORT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'NEW_ASSIGNMENT',
  'REMINDER_24H',
  'REMINDER_2H',
  'FLIGHT_REMINDER',
  'UNASSIGNED_ALERT',
  'APPROVAL_REQUESTED',
  'APPROVAL_RESOLVED',
  'ASSIGNMENT_CHANGED',
  'ASSIGNMENT_CANCELLED'
);

-- CreateEnum
CREATE TYPE "CsvImportStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'FAILED', 'COMMITTED');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "telegram_chat_id" TEXT,
  "telegram_username" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "passengers" (
  "id" UUID NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "legal_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "telegram_chat_id" TEXT,
  "telegram_username" TEXT,
  "passenger_type" "PassengerType" NOT NULL,
  "linked_primary_passenger_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "passenger_user_links" (
  "id" UUID NOT NULL,
  "passenger_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "passenger_user_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "airports" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mandirs" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mandirs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "airport_mandir_mappings" (
  "id" UUID NOT NULL,
  "airport_id" UUID NOT NULL,
  "mandir_id" UUID NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "airport_mandir_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_airports" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "airport_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_airports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_mandirs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "mandir_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_mandirs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coordinator_airports" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "airport_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coordinator_airports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coordinator_mandirs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "mandir_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coordinator_mandirs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "drivers" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "telegram_chat_id" TEXT,
  "telegram_username" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "driver_airports" (
  "id" UUID NOT NULL,
  "driver_id" UUID NOT NULL,
  "airport_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_airports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_submissions" (
  "id" UUID NOT NULL,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "raw_payload" JSONB NOT NULL,
  "normalized_payload" JSONB,
  "notes" TEXT,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itineraries" (
  "id" UUID NOT NULL,
  "status" "ItineraryStatus" NOT NULL DEFAULT 'CREATED',
  "created_by_user_id" UUID,
  "source_submission_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itinerary_passengers" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "passenger_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "itinerary_passengers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bookings" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "confirmation_number" TEXT,
  "total_cost" DECIMAL(12,2),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_allocations" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "passenger_id" UUID NOT NULL,
  "allocated_cost" DECIMAL(12,2) NOT NULL,
  "is_manual_override" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flight_segments" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "segment_order" INTEGER NOT NULL,
  "airline" TEXT NOT NULL,
  "flight_number" TEXT NOT NULL,
  "departure_airport_id" UUID NOT NULL,
  "arrival_airport_id" UUID NOT NULL,
  "departure_time_local" TIMESTAMP(6) NOT NULL,
  "arrival_time_local" TIMESTAMP(6) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flight_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accommodations" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "mandir_id" UUID NOT NULL,
  "room" TEXT,
  "check_in_date" DATE,
  "check_out_date" DATE,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accommodations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transport_tasks" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "flight_segment_id" UUID,
  "task_type" "TransportTaskType" NOT NULL,
  "airport_id" UUID NOT NULL,
  "mandir_id" UUID,
  "scheduled_time_local" TIMESTAMP(6),
  "status" "TransportTaskStatus" NOT NULL DEFAULT 'UNASSIGNED',
  "notes" TEXT,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transport_task_drivers" (
  "id" UUID NOT NULL,
  "transport_task_id" UUID NOT NULL,
  "driver_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_by_user_id" UUID,
  CONSTRAINT "transport_task_drivers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transport_task_status_history" (
  "id" UUID NOT NULL,
  "transport_task_id" UUID NOT NULL,
  "old_status" "TransportTaskStatus",
  "new_status" "TransportTaskStatus" NOT NULL,
  "changed_by_user_id" UUID,
  "changed_by_driver_id" UUID,
  "source" "AuditSource" NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_task_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_requests" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "original_payload" JSONB,
  "proposed_payload" JSONB NOT NULL,
  "review_comment" TEXT,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(6),
  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "duplicate_flags" (
  "id" UUID NOT NULL,
  "itinerary_id" UUID,
  "public_submission_id" UUID,
  "related_itinerary_id" UUID,
  "rule" "DuplicateRule" NOT NULL,
  "details" JSONB,
  "resolved_by_user_id" UUID,
  "resolved_at" TIMESTAMPTZ(6),
  "resolution_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "duplicate_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_logs" (
  "id" UUID NOT NULL,
  "notification_type" "NotificationType" NOT NULL,
  "recipient_user_id" UUID,
  "recipient_passenger_id" UUID,
  "recipient_driver_id" UUID,
  "recipient_chat_id" TEXT,
  "payload" JSONB NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "sent_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID,
  "actor_driver_id" UUID,
  "actor_passenger_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "old_values" JSONB,
  "new_values" JSONB,
  "source" "AuditSource" NOT NULL,
  "ip_address" TEXT,
  "device_info" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csv_import_jobs" (
  "id" UUID NOT NULL,
  "import_type" TEXT NOT NULL,
  "uploaded_by_user_id" UUID NOT NULL,
  "original_filename" TEXT NOT NULL,
  "status" "CsvImportStatus" NOT NULL,
  "summary" JSONB,
  "error_report" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "csv_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_query_logs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_snapshot" "UserRole" NOT NULL,
  "query_text" TEXT NOT NULL,
  "response_summary" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_query_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_telegram_chat_id_key" ON "users"("telegram_chat_id");
CREATE UNIQUE INDEX "passenger_user_links_user_id_key" ON "passenger_user_links"("user_id");
CREATE UNIQUE INDEX "passenger_user_links_passenger_id_user_id_key" ON "passenger_user_links"("passenger_id", "user_id");
CREATE UNIQUE INDEX "airports_code_key" ON "airports"("code");
CREATE UNIQUE INDEX "mandirs_name_key" ON "mandirs"("name");
CREATE UNIQUE INDEX "airport_mandir_mappings_airport_id_mandir_id_key" ON "airport_mandir_mappings"("airport_id", "mandir_id");
CREATE UNIQUE INDEX "one_default_mandir_per_airport" ON "airport_mandir_mappings"("airport_id") WHERE "is_default" = TRUE;
CREATE UNIQUE INDEX "admin_airports_user_id_airport_id_key" ON "admin_airports"("user_id", "airport_id");
CREATE UNIQUE INDEX "admin_mandirs_user_id_mandir_id_key" ON "admin_mandirs"("user_id", "mandir_id");
CREATE UNIQUE INDEX "coordinator_airports_user_id_airport_id_key" ON "coordinator_airports"("user_id", "airport_id");
CREATE UNIQUE INDEX "coordinator_mandirs_user_id_mandir_id_key" ON "coordinator_mandirs"("user_id", "mandir_id");
CREATE UNIQUE INDEX "drivers_telegram_chat_id_key" ON "drivers"("telegram_chat_id");
CREATE UNIQUE INDEX "driver_airports_driver_id_airport_id_key" ON "driver_airports"("driver_id", "airport_id");
CREATE UNIQUE INDEX "itineraries_source_submission_id_key" ON "itineraries"("source_submission_id");
CREATE UNIQUE INDEX "itinerary_passengers_itinerary_id_passenger_id_key" ON "itinerary_passengers"("itinerary_id", "passenger_id");
CREATE UNIQUE INDEX "bookings_itinerary_id_key" ON "bookings"("itinerary_id");
CREATE UNIQUE INDEX "booking_allocations_booking_id_passenger_id_key" ON "booking_allocations"("booking_id", "passenger_id");
CREATE UNIQUE INDEX "flight_segments_itinerary_id_segment_order_key" ON "flight_segments"("itinerary_id", "segment_order");
CREATE UNIQUE INDEX "transport_task_drivers_transport_task_id_driver_id_key" ON "transport_task_drivers"("transport_task_id", "driver_id");

CREATE INDEX "users_phone_idx" ON "users"("phone");
CREATE INDEX "passengers_name_idx" ON "passengers"("last_name", "first_name");
CREATE INDEX "passengers_legal_name_idx" ON "passengers"("legal_name");
CREATE INDEX "passengers_phone_idx" ON "passengers"("phone");
CREATE INDEX "airport_mandir_mappings_airport_id_idx" ON "airport_mandir_mappings"("airport_id");
CREATE INDEX "bookings_confirmation_number_idx" ON "bookings"("confirmation_number");
CREATE INDEX "flight_segments_flight_number_idx" ON "flight_segments"("flight_number");
CREATE INDEX "flight_segments_departure_time_idx" ON "flight_segments"("departure_time_local");
CREATE INDEX "flight_segments_arrival_time_idx" ON "flight_segments"("arrival_time_local");
CREATE INDEX "transport_tasks_status_idx" ON "transport_tasks"("status");
CREATE INDEX "transport_tasks_scheduled_time_idx" ON "transport_tasks"("scheduled_time_local");
CREATE INDEX "transport_tasks_airport_id_idx" ON "transport_tasks"("airport_id");
CREATE INDEX "transport_task_status_history_task_time_idx" ON "transport_task_status_history"("transport_task_id", "created_at");
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");
CREATE INDEX "approval_requests_itinerary_id_idx" ON "approval_requests"("itinerary_id");
CREATE INDEX "duplicate_flags_created_at_idx" ON "duplicate_flags"("created_at");
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "ai_query_logs_created_at_idx" ON "ai_query_logs"("created_at");

ALTER TABLE "passengers"
  ADD CONSTRAINT "passengers_linked_primary_passenger_id_fkey"
  FOREIGN KEY ("linked_primary_passenger_id") REFERENCES "passengers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "passenger_user_links"
  ADD CONSTRAINT "passenger_user_links_passenger_id_fkey"
  FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "passenger_user_links"
  ADD CONSTRAINT "passenger_user_links_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "airport_mandir_mappings"
  ADD CONSTRAINT "airport_mandir_mappings_airport_id_fkey"
  FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "airport_mandir_mappings"
  ADD CONSTRAINT "airport_mandir_mappings_mandir_id_fkey"
  FOREIGN KEY ("mandir_id") REFERENCES "mandirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_airports"
  ADD CONSTRAINT "admin_airports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_airports"
  ADD CONSTRAINT "admin_airports_airport_id_fkey"
  FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_mandirs"
  ADD CONSTRAINT "admin_mandirs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_mandirs"
  ADD CONSTRAINT "admin_mandirs_mandir_id_fkey"
  FOREIGN KEY ("mandir_id") REFERENCES "mandirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_airports"
  ADD CONSTRAINT "coordinator_airports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_airports"
  ADD CONSTRAINT "coordinator_airports_airport_id_fkey"
  FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_mandirs"
  ADD CONSTRAINT "coordinator_mandirs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_mandirs"
  ADD CONSTRAINT "coordinator_mandirs_mandir_id_fkey"
  FOREIGN KEY ("mandir_id") REFERENCES "mandirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "driver_airports"
  ADD CONSTRAINT "driver_airports_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "driver_airports"
  ADD CONSTRAINT "driver_airports_airport_id_fkey"
  FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public_submissions"
  ADD CONSTRAINT "public_submissions_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "itineraries"
  ADD CONSTRAINT "itineraries_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "itineraries"
  ADD CONSTRAINT "itineraries_source_submission_id_fkey"
  FOREIGN KEY ("source_submission_id") REFERENCES "public_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "itinerary_passengers"
  ADD CONSTRAINT "itinerary_passengers_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "itinerary_passengers"
  ADD CONSTRAINT "itinerary_passengers_passenger_id_fkey"
  FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_allocations"
  ADD CONSTRAINT "booking_allocations_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_allocations"
  ADD CONSTRAINT "booking_allocations_passenger_id_fkey"
  FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flight_segments"
  ADD CONSTRAINT "flight_segments_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flight_segments"
  ADD CONSTRAINT "flight_segments_departure_airport_id_fkey"
  FOREIGN KEY ("departure_airport_id") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "flight_segments"
  ADD CONSTRAINT "flight_segments_arrival_airport_id_fkey"
  FOREIGN KEY ("arrival_airport_id") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accommodations"
  ADD CONSTRAINT "accommodations_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accommodations"
  ADD CONSTRAINT "accommodations_mandir_id_fkey"
  FOREIGN KEY ("mandir_id") REFERENCES "mandirs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transport_tasks"
  ADD CONSTRAINT "transport_tasks_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transport_tasks"
  ADD CONSTRAINT "transport_tasks_flight_segment_id_fkey"
  FOREIGN KEY ("flight_segment_id") REFERENCES "flight_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_tasks"
  ADD CONSTRAINT "transport_tasks_airport_id_fkey"
  FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transport_tasks"
  ADD CONSTRAINT "transport_tasks_mandir_id_fkey"
  FOREIGN KEY ("mandir_id") REFERENCES "mandirs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_tasks"
  ADD CONSTRAINT "transport_tasks_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_task_drivers"
  ADD CONSTRAINT "transport_task_drivers_transport_task_id_fkey"
  FOREIGN KEY ("transport_task_id") REFERENCES "transport_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transport_task_drivers"
  ADD CONSTRAINT "transport_task_drivers_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transport_task_drivers"
  ADD CONSTRAINT "transport_task_drivers_assigned_by_user_id_fkey"
  FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_task_status_history"
  ADD CONSTRAINT "transport_task_status_history_transport_task_id_fkey"
  FOREIGN KEY ("transport_task_id") REFERENCES "transport_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transport_task_status_history"
  ADD CONSTRAINT "transport_task_status_history_changed_by_user_id_fkey"
  FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_task_status_history"
  ADD CONSTRAINT "transport_task_status_history_changed_by_driver_id_fkey"
  FOREIGN KEY ("changed_by_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "duplicate_flags"
  ADD CONSTRAINT "duplicate_flags_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "duplicate_flags"
  ADD CONSTRAINT "duplicate_flags_public_submission_id_fkey"
  FOREIGN KEY ("public_submission_id") REFERENCES "public_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "duplicate_flags"
  ADD CONSTRAINT "duplicate_flags_related_itinerary_id_fkey"
  FOREIGN KEY ("related_itinerary_id") REFERENCES "itineraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "duplicate_flags"
  ADD CONSTRAINT "duplicate_flags_resolved_by_user_id_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_recipient_passenger_id_fkey"
  FOREIGN KEY ("recipient_passenger_id") REFERENCES "passengers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_recipient_driver_id_fkey"
  FOREIGN KEY ("recipient_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_driver_id_fkey"
  FOREIGN KEY ("actor_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_passenger_id_fkey"
  FOREIGN KEY ("actor_passenger_id") REFERENCES "passengers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "csv_import_jobs"
  ADD CONSTRAINT "csv_import_jobs_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_query_logs"
  ADD CONSTRAINT "ai_query_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
