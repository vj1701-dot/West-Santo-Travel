# West Region Santos Flight Management System

## 1. Overview

This system manages santo travel logistics across the West Region, including:
- flight itineraries (multi-leg)
- transport coordination (pickup + drop-off)
- mandir accommodation
- booking cost tracking
- approval workflows
- Telegram-based operations

Primary interface:
- Telegram (Bot + Mini App)

Secondary:
- Web dashboard

---

## 2. Core Principles

- Telegram-first system
- Mobile-first UX
- Manual entry system
- No timezone conversion
- Explicit workflows (no hidden automation)
- Strong audit logging
- Role-based visibility

---

## 3. Core Data Model

## 3.1 Itinerary (Parent Object)

Contains:
- passengers
- flight segments
- transport tasks
- accommodation
- booking
- approvals
- audit logs

---

## 3.2 Passenger

Types:
- WEST_SANTO
- GUEST_SANTO
- HARIBHAKTO
- EXTRA_SEAT

Fields:
- first_name
- last_name
- legal_name
- email (optional)
- phone (optional)
- telegram_chat_id
- type
- linked_primary_passenger_id (for EXTRA_SEAT)

Rules:
- Always create passenger record (even without login)
- Guest santos remain guest even if later linked to account

---

## 3.3 Flight Segment

Fields:
- airline
- flight_number
- departure_airport
- arrival_airport
- departure_time_local
- arrival_time_local
- notes

### Time Handling (CRITICAL)
- Store exactly as entered
- NO timezone conversion
- Departure time = departure airport local
- Arrival time = arrival airport local

---

## 3.4 Booking

Fields:
- confirmation_number (admin only)
- total_cost

Rules:
- One booking per itinerary
- Default: equal split
- Manual override allowed per passenger
- EXST cost included in linked santo

---

## 3.5 Accommodation

Fields:
- mandir
- room
- check_in
- check_out
- notes

Rules:
- Multiple accommodations allowed per itinerary
- Optional but recommended

---

## 3.6 Transport Tasks

Two separate types:
- PICKUP
- DROPOFF

Fields:
- airport
- mandir
- scheduled_time
- drivers (multiple allowed)
- status
- notes

---

## 4. Transport Logic

Create transport tasks when:

- Arrival airport matches system → PICKUP
- Departure airport matches system → DROPOFF

Example:
NY → CHI → LA  
→ Only LA generates transport

---

## 5. Roles

## Admin
- Full access
- Approvals
- Reports
- Cost visibility

## Coordinator
- Scoped access (airport/mandir)
- Assign drivers
- Create/edit itineraries
- Flight edits require approval

## Passenger
- View only:
  - itinerary
  - drivers
  - accommodation
  - co-passengers

Cannot see:
- cost
- booking confirmation

## Driver
- Telegram only
- No web access

---

## 6. Telegram System

## 6.1 Identity Linking

Flow:
1. User sends `/start`
2. Bot asks for email OR phone
3. Normalize input
4. Match:
   - email first
   - phone second
5. Store chat_id

chat_id is primary identity.

---

## 6.2 Notification Rules

All messages MUST include:
- passenger names
- passenger count
- flight number
- route (FROM → TO)
- time
- airport
- mandir
- notes

---

## 6.3 Notification Types

- New assignment
- 24-hour reminder
- 2-hour reminder
- Flight reminder
- Unassigned alert
- Approval request
- Approval resolved
- Assignment changed
- Assignment cancelled

---

## 7. Approval Workflow

Coordinator edits → Pending → Admin approves

Applies to:
- flight segments
- passengers
- accommodation
- core itinerary data

NOT required for:
- driver assignments

---

## 8. Public Submission

Open form:
- multiple passengers
- flight segments
- notes

Flow:
Submit → Admin review → Approve → Create itinerary

Mandir auto-mapped from airport.

---

## 9. Duplicate Detection

Trigger if:
- same passenger + flight + date
- same booking confirmation
- same legal name + similar route/time

Behavior:
- flag only
- no auto merge

---

## 10. Cancellation

Allowed:
- Admin
- Coordinator

Effect:
- cancel itinerary
- cancel all transport tasks
- notify all

---

## 11. Driver Rules

- Multiple drivers per task allowed
- No hard availability constraints
- Show warning on overlap
- Notify driver if removed

---

## 12. Search

Must support:
- passenger name
- airport
- mandir
- flight number
- booking confirmation

---

## 13. Reports

- cost reports
- mandir activity
- driver activity
- airport activity

Export:
- CSV
- Excel

---

## 14. Audit Logs

Track:
- all changes
- approvals
- Telegram actions
- assignment changes
- linking
- imports

Include:
- actor
- old/new values
- timestamp
- source

---

## 15. System Architecture

Frontend:
- Next.js
- Tailwind

Backend:
- NestJS

Database:
- PostgreSQL

Bot:
- Telegram

Worker:
- reminders + retries

Deployment:
- Docker (Windows Server)

---

## 16. Success Criteria

- Clear operational visibility
- Reliable Telegram workflows
- No confusion in assignments
- Full auditability
- Fast mobile UX