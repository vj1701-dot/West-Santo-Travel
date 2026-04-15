# West Santo Travel

This repository is a self-hosted travel operations system for West Region santos. It combines a Next.js web console, PostgreSQL, Keycloak authentication, a Telegram bot worker, and a reminder scheduler to manage passenger itineraries, airport transport, mandir stays, staff access, and operational notifications.

This document is the single source of truth for the project scope, product requirements, architecture, installation, setup, and day-to-day operating notes.

## Product Summary

### Purpose

The product replaces ad hoc coordination across spreadsheets, chat threads, and manual follow-up. It is meant to give the West Region team one system for:

- tracking santo and guest travel
- managing passengers, drivers, and staff users
- coordinating airport pickups and drop-offs
- storing booking and accommodation details
- handling approval-driven changes
- collecting flight details from a public intake form
- linking Telegram accounts for notifications
- scheduling reminder-based operational messaging

### Primary Users

- Admin: full system access, exports, approvals, provisioning, and oversight
- Coordinator: creates and updates trips, manages passengers and drivers, and handles operations
- Passenger: web access to their own itinerary view
- Driver: Telegram-linked transport record, not a web login role

### Product Goals

- Centralize all travel and transport records in one database
- Keep authentication external and authorization local
- Auto-generate transport tasks from airport-to-mandir mappings
- Preserve operational auditability for key changes
- Support both internal planning and public intake
- Make the Docker stack the default local and deployment runtime

### Non-Goals For The Current Build

- Native mobile apps
- Full CRM or finance tooling
- Automated airline integrations
- Public self-service passenger logins beyond the current web role model
- AI assistant workflows described in older docs but not present in code

## Current Scope And Functional Requirements

### 1. Identity And Access

- Keycloak is the identity provider for the web app.
- The local `User` table is the source of truth for authorization.
- A successful Keycloak login does not grant app access unless a matching active local user exists.
- Supported web roles are `ADMIN`, `COORDINATOR`, and `PASSENGER`.
- Drivers are managed in a separate `Driver` table and currently operate through Telegram linkage rather than browser login.

### 2. Travel And Itinerary Management

- Admins and coordinators must be able to create itineraries with one or more flight segments.
- A trip can include passengers, booking details, accommodations, notes, and generated transport tasks.
- Flight times are entered in airport-local time, stored with the airport timezone, and converted to UTC for scheduling logic.
- Passenger records are separate from user records so guests and non-login travelers can still be tracked.

### 3. Transport Operations

- The system must map airports to mandirs through `AirportMandirMapping`.
- When a flight segment is created or updated, the system must auto-generate a `PICKUP` task for monitored arrival airports.
- When a flight segment is created or updated, the system must auto-generate a `DROPOFF` task for monitored departure airports.
- Transport tasks can be assigned to one or more drivers.
- Transport task statuses are tracked separately from itinerary status.

### 4. Operational Workflows

- Admins and coordinators must be able to manage users, passengers, drivers, and reminder rules from the web app.
- Admins must be able to review approval requests.
- Public flight submissions must be accepted without login and stored for admin review.
- The system must support duplicate-related submission outcomes such as `DUPLICATE_FLAGGED`.
- Admins must be able to export core datasets as CSV.

### 5. Notifications And Background Processing

- Reminder rules must be configurable in the app and evaluated by a scheduler service.
- Notifications are queued in the database and delivered by the bot worker.
- The Telegram bot must support linking a chat to an existing record by phone number or shared contact.
- The bot must tolerate scaffold mode when `TELEGRAM_BOT_TOKEN` is not configured.

### 6. Auditability

- Important writes must create audit log entries.
- Identity linking and key operational status changes must be traceable.
- Approval and review flows must preserve proposed versus accepted changes.

## Honest Status Of The Current Repository

The codebase already implements a meaningful v1, but some earlier Markdown docs described features that are still aspirational. The current repository status is:

Implemented now:

- Next.js web app with authenticated dashboard and management screens
- Prisma/Postgres data model for users, passengers, airports, mandirs, trips, segments, bookings, accommodations, drivers, tasks, approvals, submissions, reminders, notifications, and audits
- Keycloak-backed login with local authorization checks
- Docker Compose stack for web, bot, scheduler, database, and Keycloak
- Public submission intake endpoint and page at `/submit-flight`
- CSV exports for trips, passengers, drivers, and users
- Reminder rule CRUD and scheduler evaluation loop
- Telegram phone/contact linking and queued notification dispatch

Partially implemented or intentionally deferred:

- AI chatbot functionality mentioned in older planning docs is not implemented in this repository

## Repository Structure

```text
.
├── apps/
│   ├── web/         Next.js 16 web console and API routes
│   ├── bot/         Telegram worker for account linking and notification delivery
│   └── scheduler/   Background process for reminder evaluation
├── packages/
│   ├── core/        Shared business helpers for dashboard, timezone, and transport logic
│   └── data/        Prisma-backed repository layer used by web, bot, and scheduler
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.mjs
├── scripts/
│   └── bootstrap-keycloak.sh
├── docker-compose.yml
└── .env.example
```

## Architecture

### Runtime Services

- `db`: Postgres 16 for application data on `localhost:5432`
- `keycloak-db`: Postgres 16 for Keycloak on `localhost:5433`
- `keycloak`: identity provider on `http://localhost:8081`
- `keycloak-setup`: one-shot bootstrap that creates or updates the realm, OIDC client, optional Google IdP, and optional development login
- `bootstrap`: one-shot Prisma schema push and seed step
- `web`: Next.js app on `http://localhost:3000`
- `bot`: Telegram worker that links accounts and sends queued notifications
- `scheduler`: periodic reminder-rule scanner and queue producer

### Web App Surface

- `/`: dashboard and upcoming trip overview
- `/add-flight`: trip builder for admins and coordinators
- `/passengers`: passenger directory and edit flow
- `/drivers`: driver directory and airport assignment flow
- `/users`: access provisioning and identity status
- `/reminders`: reminder rule management
- `/admin`: export console
- `/approvals`: approval review list
- `/submit-flight`: public guest submission form
- `/access-denied`: authorization failure page

### API Surface

The web app exposes route handlers under `apps/web/app/api` for:

- dashboard snapshot
- airports and mandirs
- users and passengers
- drivers
- itineraries and itinerary segments
- approvals and approval review
- public submissions and submission review
- transport task listing, assignment, and status updates
- reminder rules
- CSV exports
- Telegram linking
- NextAuth / Keycloak auth callbacks

### Authentication Model

- NextAuth is configured with the Keycloak provider.
- Login succeeds only when the Keycloak identity email matches an active local `User`.
- On successful login, the app stores local role and profile data in the session token.
- Unauthorized or inactive users are redirected to `/access-denied`.

## Core Domain Model

### Main Entities

- `User`: staff and passenger-facing web identities with local role and active state
- `Passenger`: all travelers, including guests and extra seats
- `PassengerUserLink`: optional bridge between a passenger record and a login user
- `Airport`: airport directory with IATA code and IANA timezone
- `Mandir`: destination or stay location
- `AirportMandirMapping`: default transport mapping between airport and mandir
- `Itinerary`: parent travel record
- `FlightSegment`: one flight leg with local and UTC timestamps
- `Booking` and `BookingAllocation`: booking reference, total cost, and passenger cost split
- `Accommodation`: mandir stay details
- `Driver` and `DriverAirport`: transport driver directory and airport coverage
- `TransportTask` and `TransportTaskDriver`: pickup/drop-off work assignments
- `ApprovalRequest`: pending and reviewed change requests
- `PublicSubmission`: external intake record before admin review
- `ReminderRule` and `ReminderRun`: no-code reminder configuration and execution history
- `NotificationLog`: queued, sent, or failed notifications
- `AuditLog`: change trail

### Important Enums

- `UserRole`: `ADMIN`, `COORDINATOR`, `PASSENGER`
- `PassengerType`: `WEST_SANTO`, `GUEST_SANTO`, `HARIBHAKTO`, `EXTRA_SEAT`
- `ItineraryStatus`: `CREATED`, `CONFIRMED`, `PENDING_APPROVAL`, `CANCELLED`
- `TransportTaskType`: `PICKUP`, `DROPOFF`
- `TransportTaskStatus`: `UNASSIGNED`, `ASSIGNED`, `EN_ROUTE`, `PICKED_UP`, `DROPPED_OFF`, `COMPLETED`, `CANCELLED`
- `ApprovalStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `SubmissionStatus`: `PENDING`, `APPROVED`, `REJECTED`, `DUPLICATE_FLAGGED`
- Reminder-related enums for trigger, audience, channel, and run status

### Timezone Handling

The current implementation does not treat date entry as raw untyped text. Instead it:

- accepts local airport datetime input from forms
- stores the local datetime value
- stores the airport timezone
- derives UTC timestamps for ordering, reminders, and scheduling

This keeps airport-local intent intact while still enabling reliable background processing.

## Seed Data And Local Defaults

The bootstrap and seed flow creates a usable local sandbox:

- airports: `LAX`, `ORD`
- mandirs: `LA Mandir`, `Chicago Mandir`
- local user `admin@westsanto.org` with role `ADMIN`
- local user `coordinator@westsanto.org` with role `COORDINATOR`
- passengers: two sample santos
- drivers: one sample driver assigned to `LAX`
- one itinerary with booking, accommodation, pickup task, and a pending approval request

Important auth note:

- the application database seed creates local user records
- Keycloak login still requires a matching Keycloak user
- in development bootstrap mode, `keycloak-setup` also creates the Keycloak login named by `KEYCLOAK_DEV_LOGIN_EMAIL`

## Local Installation And Setup

### Prerequisites

- Docker Desktop with Docker Compose
- enough free ports for `3000`, `5432`, `5433`, and `8081`
- optional: Node.js 20+ if you want to run scripts outside Docker
- optional: a Telegram bot token if you want live bot polling

### 1. Configure Environment

Copy the example file and replace placeholders:

```bash
cp .env.example .env
```

Minimum values to review in `.env`:

- `APP_BASE_URL`
- `SESSION_SECRET`
- `KEYCLOAK_ISSUER_URL`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_DEV_LOGIN_PASSWORD`
- `TELEGRAM_BOT_TOKEN` if you want a live bot

Recommended local values:

- `APP_BASE_URL=http://localhost:3000`
- `KEYCLOAK_ISSUER_URL=http://localhost:8081/realms/west-santo`
- `KEYCLOAK_BOOTSTRAP_MODE=development`

Notes:

- `KEYCLOAK_ISSUER_URL` must be the browser-reachable realm URL, not the internal Docker hostname.
- If you later expose the stack on a LAN or public domain, update both `APP_BASE_URL` and `KEYCLOAK_ISSUER_URL` to those real URLs.
- If `KEYCLOAK_GOOGLE_CLIENT_ID` and `KEYCLOAK_GOOGLE_CLIENT_SECRET` are set, the bootstrap script configures Google as a Keycloak identity provider.

### 2. Start The Stack

```bash
docker compose up --build -d
```

This brings up the databases, Keycloak, bootstrap jobs, web app, bot, and scheduler.

### 3. Verify Runtime Health

```bash
docker compose ps
docker compose logs web
docker compose logs bot
docker compose logs scheduler
```

Expected local endpoints:

- app: `http://localhost:3000`
- Keycloak admin: `http://localhost:8081/admin`
- app Postgres: `localhost:5432`
- Keycloak Postgres: `localhost:5433`

### 4. First Login

In development bootstrap mode:

- the seed creates a local app admin at `admin@westsanto.org`
- the Keycloak bootstrap can also create the same Keycloak user using `KEYCLOAK_DEV_LOGIN_EMAIL` and `KEYCLOAK_DEV_LOGIN_PASSWORD`

If those values match, you can sign into the web app immediately after startup.

If you want more users:

- create or keep a local user record through the app or seed data
- create the matching user in Keycloak with the same email
- ensure the local user is active

### 5. Stop The Stack

```bash
docker compose down
```

To wipe volumes and reset the local database state:

```bash
docker compose down -v
```

## Day-To-Day Development Commands

Docker is the preferred runtime for this project. If you need local commands outside Docker, these are the main ones:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
npm run typecheck
npm run test
```

Relevant scripts:

- `npm run build`: build the web app workspace
- `npm run dev`: run the web app locally
- `npm run dev:bot`: run the bot locally
- `npm run dev:scheduler`: run the scheduler locally
- `npm run typecheck`: Next.js type generation plus TypeScript checks
- `npm run test`: package-level tests in `packages/core`

## Operational Notes

### Telegram Bot

The current bot implementation supports:

- `/start`
- phone-number or contact-share based record matching
- linking to a passenger, user, or driver record through the repository layer
- dispatching queued notifications to Telegram chats

If `TELEGRAM_BOT_TOKEN` is missing, the bot does not poll Telegram and logs that it is running in scaffold mode.

### Scheduler

The scheduler runs every `SCHEDULER_TICK_MS` milliseconds and:

- scans upcoming transport tasks
- evaluates reminder rules
- queues notifications for delivery

### Exports

Admin CSV exports are available for:

- trips and flights
- passengers
- drivers
- users

### Public Submission Flow

The public page at `/submit-flight` accepts:

- submitter name and phone
- one or more passengers
- one or more flight segments
- optional notes

Those submissions are stored for admin review and can be resolved as approved, rejected, or duplicate-flagged through the API.

## Known Gaps And Next Useful Slices

The most valuable next product slices, based on the codebase as it exists now, are:

- dedicated admin UI for reviewing public submissions
- dedicated itinerary list and transport task board
- richer coordinator workflow around scoped visibility and editing
- Telegram driver response actions for assignment acceptance and status updates
- broader automated notification templates tied to more operational events
- stronger automated tests across API routes and repository flows

## Deployment Notes

- This project is designed to run cleanly through Docker Compose first.
- For non-local environments, set `APP_BASE_URL` and `KEYCLOAK_ISSUER_URL` to the real public origin.
- Keep Keycloak client redirect and logout URIs aligned with the deployed web URL.
- Treat `SESSION_SECRET`, Keycloak admin credentials, Keycloak client secret, Google client secret, and Telegram bot token as production secrets.

## Short Project Definition

West Santo Travel is a Docker-first operations system for managing santo travel, airport transport, staff access, and reminders. The current repository already supports the core travel and admin workflows, and it is structured to grow into richer Telegram and review tooling without changing the overall architecture.
