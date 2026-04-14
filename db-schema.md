# db-schema.md

# West Region Santos Flight Management System
## PostgreSQL + Prisma Foundation Schema

This document defines the recommended relational schema for the West Region Santos Flight Management System. It is designed for:
- PostgreSQL
- Prisma ORM
- Telegram-first workflows
- approval-driven mutations
- mobile-friendly operational queries
- strong auditability

---

# 1. Design Principles

## 1.1 Core principles
- Use **Itinerary** as the parent object
- Track **all flight segments**
- Model **pickup and drop-off as separate transport tasks**
- Keep **admin / coordinator / passenger / driver visibility distinct**
- Use **chat_id** as Telegram identity
- Store segment times **exactly as entered**
- Preserve **pending approval snapshots**
- Log **all important mutations**

## 1.2 Recommended conventions
- Primary keys: UUID
- Timestamps: `created_at`, `updated_at`
- Soft delete only where operationally useful
- Use enums for role, statuses, and task types
- Keep source-of-truth business logic in backend service layer

---

# 2. PostgreSQL Enums

```sql
CREATE TYPE user_role AS ENUM ('ADMIN', 'COORDINATOR', 'PASSENGER');
CREATE TYPE passenger_type AS ENUM ('WEST_SANTO', 'GUEST_SANTO', 'HARIBHAKTO', 'EXTRA_SEAT');
CREATE TYPE itinerary_status AS ENUM ('CREATED', 'CONFIRMED', 'PENDING_APPROVAL', 'CANCELLED');
CREATE TYPE transport_task_type AS ENUM ('PICKUP', 'DROPOFF');
CREATE TYPE transport_task_status AS ENUM (
  'UNASSIGNED',
  'ASSIGNED',
  'EN_ROUTE',
  'PICKED_UP',
  'DROPPED_OFF',
  'COMPLETED',
  'CANCELLED'
);
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE submission_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE_FLAGGED');
CREATE TYPE duplicate_rule AS ENUM (
  'PASSENGER_FLIGHT_DATE',
  'BOOKING_CONFIRMATION_TRAVELER',
  'LEGAL_NAME_ROUTE_CLOSE_TIME'
);
CREATE TYPE audit_source AS ENUM ('WEB', 'BOT', 'SYSTEM', 'IMPORT');
CREATE TYPE notification_status AS ENUM ('QUEUED', 'SENT', 'FAILED');
CREATE TYPE notification_type AS ENUM (
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
```

---

# 3. Core Tables

## 3.1 users
Represents authenticated web users.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  telegram_chat_id TEXT UNIQUE,
  telegram_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- Only users with assigned access should be allowed into the web app.
- `telegram_chat_id` is the durable Telegram identifier.
- `telegram_username` is informational only.

---

## 3.2 passengers
Represents all travelers, including guests, haribhakto, and extra seats.

```sql
CREATE TABLE passengers (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  legal_name TEXT,
  email TEXT,
  phone TEXT,
  telegram_chat_id TEXT,
  telegram_username TEXT,
  passenger_type passenger_type NOT NULL,
  linked_primary_passenger_id UUID REFERENCES passengers(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- `linked_primary_passenger_id` is useful for `EXTRA_SEAT`.
- A passenger may exist without login access.
- Passenger records should not be conflated with `users`.

---

## 3.3 passenger_user_links
Optional table to link a passenger record to a user record.

```sql
CREATE TABLE passenger_user_links (
  id UUID PRIMARY KEY,
  passenger_id UUID NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- Supports cases where not every passenger is a user.
- One user should usually map to one passenger.

---

## 3.4 airports

```sql
CREATE TABLE airports (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3.5 mandirs

```sql
CREATE TABLE mandirs (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3.6 airport_mandir_mappings
Maps airports to default mandirs.

```sql
CREATE TABLE airport_mandir_mappings (
  id UUID PRIMARY KEY,
  airport_id UUID NOT NULL REFERENCES airports(id) ON DELETE CASCADE,
  mandir_id UUID NOT NULL REFERENCES mandirs(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (airport_id, mandir_id)
);
```

### Constraint recommendation
At most one default per airport. Implement with partial unique index:

```sql
CREATE UNIQUE INDEX one_default_mandir_per_airport
ON airport_mandir_mappings (airport_id)
WHERE is_default = TRUE;
```

---

# 4. Access Ownership Tables

## 4.1 admin_airports

```sql
CREATE TABLE admin_airports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  airport_id UUID NOT NULL REFERENCES airports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, airport_id)
);
```

## 4.2 admin_mandirs

```sql
CREATE TABLE admin_mandirs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mandir_id UUID NOT NULL REFERENCES mandirs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mandir_id)
);
```

## 4.3 coordinator_airports

```sql
CREATE TABLE coordinator_airports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  airport_id UUID NOT NULL REFERENCES airports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, airport_id)
);
```

## 4.4 coordinator_mandirs

```sql
CREATE TABLE coordinator_mandirs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mandir_id UUID NOT NULL REFERENCES mandirs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mandir_id)
);
```

---

# 5. Driver Tables

## 5.1 drivers
Drivers are Telegram-first operational contacts and do not need web access.

```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  telegram_chat_id TEXT UNIQUE,
  telegram_username TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 5.2 driver_airports

```sql
CREATE TABLE driver_airports (
  id UUID PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  airport_id UUID NOT NULL REFERENCES airports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (driver_id, airport_id)
);
```

---

# 6. Itinerary Layer

## 6.1 itineraries

```sql
CREATE TABLE itineraries (
  id UUID PRIMARY KEY,
  status itinerary_status NOT NULL DEFAULT 'CREATED',
  created_by_user_id UUID REFERENCES users(id),
  notes TEXT,
  source_submission_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- `source_submission_id` can later link back to a public submission.
- Keep itinerary-level notes separate from segment notes.

---

## 6.2 itinerary_passengers

```sql
CREATE TABLE itinerary_passengers (
  id UUID PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (itinerary_id, passenger_id)
);
```

---

## 6.3 bookings

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  itinerary_id UUID NOT NULL UNIQUE REFERENCES itineraries(id) ON DELETE CASCADE,
  confirmation_number TEXT,
  total_cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- `confirmation_number` is admin-only in visibility.
- One booking per itinerary.

---

## 6.4 booking_allocations

```sql
CREATE TABLE booking_allocations (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  allocated_cost NUMERIC(12,2) NOT NULL,
  is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, passenger_id)
);
```

### Notes
- Equal split can be computed and stored explicitly.
- Manual overrides should be preserved.

---

## 6.5 flight_segments

```sql
CREATE TABLE flight_segments (
  id UUID PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  segment_order INT NOT NULL,
  airline TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  departure_airport_id UUID NOT NULL REFERENCES airports(id),
  arrival_airport_id UUID NOT NULL REFERENCES airports(id),
  departure_time_local TIMESTAMP NOT NULL,
  arrival_time_local TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (itinerary_id, segment_order)
);
```

### Notes
- Times are stored exactly as entered.
- Do not perform timezone normalization in v1.

---

## 6.6 accommodations

```sql
CREATE TABLE accommodations (
  id UUID PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  mandir_id UUID NOT NULL REFERENCES mandirs(id),
  room TEXT,
  check_in_date DATE,
  check_out_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 7. Transport Tables

## 7.1 transport_tasks

```sql
CREATE TABLE transport_tasks (
  id UUID PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  flight_segment_id UUID REFERENCES flight_segments(id) ON DELETE SET NULL,
  task_type transport_task_type NOT NULL,
  airport_id UUID NOT NULL REFERENCES airports(id),
  mandir_id UUID REFERENCES mandirs(id),
  scheduled_time_local TIMESTAMP,
  status transport_task_status NOT NULL DEFAULT 'UNASSIGNED',
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- Separate tasks for pickup and drop-off.
- `scheduled_time_local` should be based on operational use case.

---

## 7.2 transport_task_drivers

```sql
CREATE TABLE transport_task_drivers (
  id UUID PRIMARY KEY,
  transport_task_id UUID NOT NULL REFERENCES transport_tasks(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by_user_id UUID REFERENCES users(id),
  UNIQUE (transport_task_id, driver_id)
);
```

---

## 7.3 transport_task_status_history

```sql
CREATE TABLE transport_task_status_history (
  id UUID PRIMARY KEY,
  transport_task_id UUID NOT NULL REFERENCES transport_tasks(id) ON DELETE CASCADE,
  old_status transport_task_status,
  new_status transport_task_status NOT NULL,
  changed_by_user_id UUID REFERENCES users(id),
  changed_by_driver_id UUID REFERENCES drivers(id),
  source audit_source NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 8. Approval Tables

## 8.1 approval_requests

```sql
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES users(id),
  reviewed_by_user_id UUID REFERENCES users(id),
  status approval_status NOT NULL DEFAULT 'PENDING',
  entity_type TEXT NOT NULL,
  entity_id UUID,
  original_payload JSONB,
  proposed_payload JSONB NOT NULL,
  review_comment TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
```

### Notes
- Use `entity_type` like `ITINERARY`, `FLIGHT_SEGMENT`, `ACCOMMODATION`.
- Payload snapshots are critical for auditability.

---

# 9. Public Submission Tables

## 9.1 public_submissions

```sql
CREATE TABLE public_submissions (
  id UUID PRIMARY KEY,
  status submission_status NOT NULL DEFAULT 'PENDING',
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB,
  notes TEXT,
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- `raw_payload` stores original submission.
- `normalized_payload` stores parsed structure for review.

---

# 10. Duplicate Review Tables

## 10.1 duplicate_flags

```sql
CREATE TABLE duplicate_flags (
  id UUID PRIMARY KEY,
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  public_submission_id UUID REFERENCES public_submissions(id) ON DELETE CASCADE,
  related_itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL,
  rule duplicate_rule NOT NULL,
  details JSONB,
  resolved_by_user_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 11. Notification Tables

## 11.1 notification_logs

```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY,
  notification_type notification_type NOT NULL,
  recipient_user_id UUID REFERENCES users(id),
  recipient_passenger_id UUID REFERENCES passengers(id),
  recipient_driver_id UUID REFERENCES drivers(id),
  recipient_chat_id TEXT,
  payload JSONB NOT NULL,
  status notification_status NOT NULL DEFAULT 'QUEUED',
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- One row per recipient event is easiest to reason about.
- Store rendered or near-rendered payload for debugging.

---

# 12. Audit Tables

## 12.1 audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),
  actor_driver_id UUID REFERENCES drivers(id),
  actor_passenger_id UUID REFERENCES passengers(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  source audit_source NOT NULL,
  ip_address TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Examples
- `CREATE_ITINERARY`
- `UPDATE_FLIGHT_SEGMENT`
- `APPROVE_REQUEST`
- `LINK_TELEGRAM`
- `ASSIGN_DRIVER`
- `DRIVER_ACCEPTED`
- `CANCEL_ITINERARY`

---

# 13. Import Tables

## 13.1 csv_import_jobs

```sql
CREATE TABLE csv_import_jobs (
  id UUID PRIMARY KEY,
  import_type TEXT NOT NULL,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  original_filename TEXT NOT NULL,
  status TEXT NOT NULL,
  summary JSONB,
  error_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notes
- `status` can be free-text or its own enum later.
- Good values: `UPLOADED`, `VALIDATED`, `FAILED`, `COMMITTED`.

---

# 14. AI Query Logging

## 14.1 ai_query_logs

```sql
CREATE TABLE ai_query_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  role_snapshot user_role NOT NULL,
  query_text TEXT NOT NULL,
  response_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

# 15. Suggested Indexes

## High-priority indexes
```sql
CREATE INDEX idx_passengers_name ON passengers (last_name, first_name);
CREATE INDEX idx_passengers_legal_name ON passengers (legal_name);
CREATE INDEX idx_passengers_phone ON passengers (phone);
CREATE INDEX idx_users_phone ON users (phone);
CREATE INDEX idx_users_telegram_chat_id ON users (telegram_chat_id);
CREATE INDEX idx_airports_code ON airports (code);
CREATE INDEX idx_flight_segments_flight_number ON flight_segments (flight_number);
CREATE INDEX idx_flight_segments_departure_time ON flight_segments (departure_time_local);
CREATE INDEX idx_flight_segments_arrival_time ON flight_segments (arrival_time_local);
CREATE INDEX idx_transport_tasks_status ON transport_tasks (status);
CREATE INDEX idx_transport_tasks_scheduled_time ON transport_tasks (scheduled_time_local);
CREATE INDEX idx_approval_requests_status ON approval_requests (status);
CREATE INDEX idx_notification_logs_status ON notification_logs (status);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);
```

---

# 16. Prisma Model Outline

Below is a condensed starting Prisma schema structure. It is not the full final schema, but it shows how the core model should be represented.

```prisma
enum UserRole {
  ADMIN
  COORDINATOR
  PASSENGER
}

enum PassengerType {
  WEST_SANTO
  GUEST_SANTO
  HARIBHAKTO
  EXTRA_SEAT
}

enum ItineraryStatus {
  CREATED
  CONFIRMED
  PENDING_APPROVAL
  CANCELLED
}

enum TransportTaskType {
  PICKUP
  DROPOFF
}

enum TransportTaskStatus {
  UNASSIGNED
  ASSIGNED
  EN_ROUTE
  PICKED_UP
  DROPPED_OFF
  COMPLETED
  CANCELLED
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id               String   @id @default(uuid())
  email            String   @unique
  phone            String?
  firstName        String
  lastName         String
  role             UserRole
  isActive         Boolean  @default(true)
  telegramChatId   String?  @unique
  telegramUsername String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Passenger {
  id                      String        @id @default(uuid())
  firstName               String
  lastName                String
  legalName               String?
  email                   String?
  phone                   String?
  telegramChatId          String?
  telegramUsername        String?
  passengerType           PassengerType
  linkedPrimaryPassengerId String?
  notes                   String?
  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt
}

model Airport {
  id        String   @id @default(uuid())
  code      String   @unique
  name      String
  city      String?
  state     String?
  country   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Mandir {
  id        String   @id @default(uuid())
  name      String   @unique
  city      String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Itinerary {
  id             String          @id @default(uuid())
  status         ItineraryStatus @default(CREATED)
  createdByUserId String?
  notes          String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model FlightSegment {
  id                  String   @id @default(uuid())
  itineraryId         String
  segmentOrder        Int
  airline             String
  flightNumber        String
  departureAirportId  String
  arrivalAirportId    String
  departureTimeLocal  DateTime
  arrivalTimeLocal    DateTime
  notes               String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([itineraryId, segmentOrder])
}

model TransportTask {
  id                 String              @id @default(uuid())
  itineraryId        String
  flightSegmentId    String?
  taskType           TransportTaskType
  airportId          String
  mandirId           String?
  scheduledTimeLocal DateTime?
  status             TransportTaskStatus @default(UNASSIGNED)
  notes              String?
  createdByUserId    String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
}
```

---

# 17. Recommended Query Patterns

## Coordinator operational list
Filter itineraries by:
- any segment arrival/departure airport in coordinator airports
- any accommodation mandir in coordinator mandirs
- any transport task airport / mandir in coordinator assignments

## Passenger dashboard
Resolve by:
- linked passenger record
- itinerary_passengers join
- include segments, accommodation, transport tasks, co-passengers
- exclude booking confirmation and cost

## Driver assignment message
Build from:
- transport task
- related segment
- itinerary passengers
- accommodation
- driver assignment

---

# 18. Implementation Notes

## What should be generated automatically
- transport tasks when managed airports are present
- booking allocations when booking created or passenger list changes
- audit logs on all critical actions
- notifications from worker or mutation hooks

## What should remain manual
- driver selection
- room assignment
- admin approvals
- duplicate resolution

---

# 19. Minimum Seed Data Needed

Before the app becomes usable, seed:
- airports
- mandirs
- airport-to-mandir mappings
- first admin account
- a few coordinators
- a few drivers
- status enums already handled by DB/Prisma

---

# 20. Foundation Verdict

This schema is sufficient to unlock:
- backend service design
- API contracts
- Telegram bot flows
- dashboard building
- reporting
- approval workflows
- auditability
- import flows
