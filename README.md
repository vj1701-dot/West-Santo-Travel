# West Santo Travel

This repository is a self-hosted travel operations system for West Region santos. It combines a Next.js web console, PostgreSQL, Better Auth authentication, a Telegram bot worker, and a reminder scheduler to manage passenger itineraries, airport transport, mandir stays, staff access, and operational notifications.

This document is the single source of truth for the project scope, product requirements, architecture, installation, setup, and day-to-day operating notes.

## Product Summary

### Purpose

The product replaces ad hoc coordination across spreadsheets, chat threads, and manual follow-up. It is meant to give the West Region team one system for:

- tracking santo and guest travel
- managing passengers, drivers, and staff users
- coordinating airport pickups and drop-offs, including multiple transport entries per segment
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
- Support structured transport planning and driver assignment inside trip creation/editing
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

- Better Auth is the authentication provider for the web app.
- The local `User` table is the source of truth for authorization.
- Authenticated sessions are accepted only for local users with a valid role and active state.
- Supported web roles are `ADMIN`, `COORDINATOR`, and `PASSENGER`.
- Drivers are managed in a separate `Driver` table and currently operate through Telegram linkage rather than browser login.

### 2. Travel And Itinerary Management

- Admins and coordinators must be able to create and fully edit itineraries with one or more flight segments.
- A trip can include passengers, booking details, accommodation notes, trip notes, and transport tasks.
- Itineraries remain passenger-based even when staff selects a user or driver as the traveler; the system resolves or auto-creates a persisted passenger record.
- Cancelling an itinerary archives it instead of removing it, while admins still retain a separate hard-delete path for mistaken records.
- Flight times are entered in airport-local time, stored with the airport timezone, and converted to UTC for scheduling logic.
- Passenger records are separate from user records so guests and non-login travelers can still be tracked.

### 3. Transport Operations

- The system uses airport-to-mandir mappings as defaults when creating transport tasks.
- A flight segment can have multiple `PICKUP` tasks and multiple `DROPOFF` tasks.
- Each transport task can be assigned to one or more drivers.
- Transport task statuses are tracked separately from itinerary status.

### 4. Operational Workflows

- Admins and coordinators must be able to manage users, passengers, drivers, and reminder rules from the web app.
- Admins must be able to review approval requests.
- Public flight submissions must be accepted without login and stored for admin review.
- The system must support duplicate-related submission outcomes such as `DUPLICATE_FLAGGED`.
- Admins must be able to export core datasets as CSV.

### 5. Notifications And Background Processing

- Reminder rules must be configurable in the app and evaluated by a scheduler service.
- Notifications are queued in the database and delivered by Telegram for admins/coordinators and Twilio SMS for passengers/drivers.
- The Telegram bot must support linking a chat to an existing record by phone number or shared contact, accepting phone numbers in any common format.
- Admins keep full web visibility, but Telegram notifications and `/upcoming` stay scoped to their assigned airports.
- The bot must tolerate scaffold mode when `TELEGRAM_BOT_TOKEN` is not configured.

### 6. Auditability

- Important writes must create audit log entries.
- Identity linking and key operational status changes must be traceable.
- Approval and review flows must preserve proposed versus accepted changes.

## Honest Status Of The Current Repository

The codebase already implements a meaningful v1, but some earlier Markdown docs described features that are still aspirational. The current repository status is:

Implemented now:

- Next.js web app with authenticated dashboard and management screens
- Tailwind CSS and shadcn/ui foundation layered alongside the legacy CSS system
- Prisma/Postgres data model for users, passengers, airports, mandirs, trips, segments, bookings, accommodations, drivers, tasks, approvals, submissions, reminders, notifications, and audits
- Better Auth-backed login (Google + email/password) with local authorization checks
- Docker Compose stack for web, bot, scheduler, and database
- Add Flight trip editor with passenger autocomplete, airline autocomplete, per-segment pickup/dropoff entries, inline driver creation, and accommodation notes
- Itinerary list redesign with edit flow at `/itineraries/[id]/edit`
- Archive-on-cancel itinerary lifecycle with admin-only hard delete
- Overview filters on `/` for passenger and airport, with role-aware scoping
- Public submission intake endpoint and page at `/submission`
- CSV exports for trips, passengers, drivers, and users
- Built-in notification workflows plus configurable reminder rule CRUD
- Telegram phone/contact linking, `/upcoming`, and queued notification dispatch
- Twilio SMS dispatch for passenger and driver notifications
- Google Sheets snapshot sync with automatic flight updates and review-required traveler or driver roster changes on existing synced trips

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
├── docker-compose.yml
└── .env.example
```

## Architecture

### Runtime Services

- `db`: Postgres 16 for application data on `localhost:5432`
- `bootstrap`: one-shot Prisma schema push and seed step
- `web`: Next.js app on `http://localhost:3000`
- `bot`: Telegram worker that links accounts and sends queued notifications
- `scheduler`: periodic reminder-rule scanner, built-in workflow scheduler, and Twilio SMS dispatcher

### Web App Surface

- `/`: compact upcoming trip overview with passenger and airport filters
- `/sign-in`: standalone authentication page for existing users
- `/sign-up`: standalone authentication page for new users
- `/add-flight`: trip builder for admins and coordinators
- `/itineraries`: redesigned itinerary list with edit entrypoint
- `/itineraries/[id]/edit`: full trip edit flow for admins and coordinators
- `/passengers`: passenger directory and edit flow
- `/drivers`: driver directory and airport assignment flow
- `/users`: access provisioning and identity status
- `/reminders`: built-in workflow reference plus advanced reminder rule management
- `/submission`: public guest submission form
- `/submissions`: admin/coordinator submission review queue
- `/submissions/[id]/edit`: complete a public submission and convert it into an itinerary
- `/submit-flight`: legacy path that redirects to `/submission`
- `/admin`: export console
- `/approvals`: approval review list
- `/access-denied`: authorization failure page

### API Surface

The web app exposes route handlers under `apps/web/app/api` for:

- dashboard snapshot
- airports and mandirs
- users and passengers
- drivers
- itineraries and itinerary segments
- approvals and approval review
- public submissions, submission review, and submission conversion
- transport task listing, assignment, and status updates through APIs only
- reminder rules
- CSV exports
- Telegram linking
- Better Auth session and auth callbacks

### Authentication Model

- Better Auth is configured with Google social login and email/password.
- New signups default to `PASSENGER` with active access, and existing role checks remain local to the app database.
- Authorization for pages and APIs still resolves local `User` role and active status.
- Unauthenticated web requests are redirected to `/sign-in`.
- Authenticated users that are missing local access (inactive/missing role/not provisioned) are redirected to `/access-denied`.

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
- `Accommodation`: optional stay/accommodation notes, with mandir linkage now optional
- `Driver` and `DriverAirport`: transport driver directory and airport coverage
- `TransportTask` and `TransportTaskDriver`: pickup/drop-off work assignments, including multiple tasks per segment and multiple drivers per task
- `ApprovalRequest`: pending and reviewed change requests
- `PublicSubmission`: external intake record before admin review
- `ReminderRule` and `ReminderRun`: advanced reminder configuration and execution history
- `NotificationLog`: queued, sent, or failed Telegram and SMS notifications
- `AuditLog`: change trail

### Important Enums

- `UserRole`: `ADMIN`, `COORDINATOR`, `PASSENGER`
- `PassengerType`: `WEST_SANTO`, `GUEST_SANTO`, `HARIBHAKTO`, `EXTRA_SEAT`
- `ItineraryStatus`: `CREATED`, `CONFIRMED`, `PENDING_APPROVAL`, `CANCELLED`
- `TransportTaskType`: `PICKUP`, `DROPOFF`
- `TransportTaskStatus`: `UNASSIGNED`, `ASSIGNED`, `EN_ROUTE`, `PICKED_UP`, `DROPPED_OFF`, `COMPLETED`, `CANCELLED`
- `ApprovalStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `SubmissionStatus`: `PENDING`, `APPROVED`, `REJECTED`, `DUPLICATE_FLAGGED`
- Reminder-related enums for trigger, audience, channel, notification channel, and run status

### Timezone Handling

The current implementation does not treat date entry as raw untyped text. Instead it:

- accepts local airport datetime input from forms
- stores the local datetime value
- stores the airport timezone
- derives UTC timestamps for ordering, reminders, and scheduling

This keeps airport-local intent intact while still enabling reliable background processing.

## Seed Data And Local Defaults

The bootstrap and seed flow creates a usable local sandbox:

- airports: imported from OurAirports during seed/bootstrap
- mandirs: imported from official BAPS global network pages during seed/bootstrap
- local user from `ADMIN_EMAIL` (default `admin@westsanto.org`) with role `ADMIN`
- local user `coordinator@westsanto.org` with role `COORDINATOR`
- passengers: two sample santos
- drivers: one sample driver assigned to `LAX`
- one itinerary with booking, accommodation/task seed data, and a pending approval request

Important auth note:

- the application database seed creates local user records
- Better Auth uses those same local users for authorization decisions
- open sign-up creates local users with default `PASSENGER` role

## Local Installation And Setup

### Prerequisites

- Docker Desktop with Docker Compose
- enough free ports for `3000` and `5432`
- optional: Node.js 20+ if you want to run scripts outside Docker
- optional: a Telegram bot token if you want live bot polling

### 1. Configure Environment

Copy the example file and replace placeholders:

```bash
cp .env.example .env
```

Minimum values to review in `.env`:

- `DATABASE_URL` for app commands you run on your host machine
- `DOCKER_DATABASE_URL` for services running inside Docker Compose
- `APP_BASE_URL`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for seeded admin credentials
- `TELEGRAM_BOT_TOKEN` if you want a live bot
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` if you want live SMS delivery
- `GOOGLE_SHEETS_SYNC_SECRET` if you want Google Apps Script to sync a sheet into live trips
- `AIRPORT_IMPORT_URL` if you want to override the default OurAirports feed during seed/bootstrap
- `MANDIR_IMPORT_ENABLED` if you want to skip the BAPS mandir import during seed/bootstrap

Recommended local values:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/west_santo_travel?schema=public`
- `DOCKER_DATABASE_URL=postgresql://postgres:postgres@db:5432/west_santo_travel?schema=public`
- `APP_BASE_URL=http://localhost:3000`
- `BETTER_AUTH_URL=http://localhost:3000`
- `NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000`
- `TWILIO_FROM_NUMBER=+15551234567`
- `AIRPORT_IMPORT_ENABLED=true`
- `MANDIR_IMPORT_ENABLED=true`

Database host rules:

- use `db` when the process runs inside Docker Compose
- use `localhost` when the process runs on your host machine and talks to Postgres in Docker

### 2. Start The Stack

```bash
docker compose up --build -d
```

This brings up the database, bootstrap job, web app, bot, and scheduler.

Compose services always read `DOCKER_DATABASE_URL`, so a host-only `DATABASE_URL` set to `localhost` will not break container startup.

### 3. Verify Runtime Health

```bash
docker compose ps
docker compose logs web
docker compose logs bot
docker compose logs scheduler
```

Expected local endpoints:

- app: `http://localhost:3000`
- app Postgres: `localhost:5432`

### 4. First Login

- the seed creates a local app admin from `ADMIN_EMAIL` (default: `admin@westsanto.org`)
- if `ADMIN_PASSWORD` is set, that admin can sign in with email/password
- you can sign in with Google or email/password through Better Auth
- users can also self-register and receive default `PASSENGER` access

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

If you run the web app locally while keeping Postgres in Docker:

- set `DATABASE_URL` host to `localhost` (not `db`)
- leave `DOCKER_DATABASE_URL` on `db` for Compose-managed services
- keep the database service running with `docker compose up -d db`

Relevant scripts:

- `npm run build`: build the web app workspace
- `npm run dev`: run the web app locally
- `npm run dev:bot`: run the bot locally
- `npm run dev:scheduler`: run the scheduler locally
- `npm run db:migrate`: apply migrations
- `npm run typecheck`: Next.js type generation plus TypeScript checks
- `npm run test`: package-level tests in `packages/core`
- `npm run docker:test`: run tests in the Docker stack

Airport import notes:

- the bootstrap seed now imports a full airport directory from OurAirports during `npm run db:seed` and the Docker `bootstrap` service
- by default it uses `https://davidmegginson.github.io/ourairports-data/airports.csv`
- set `AIRPORT_IMPORT_ENABLED=false` to skip the bulk import
- set `AIRPORT_IMPORT_URL` to point at a different CSV mirror if needed
- the bootstrap seed also imports BAPS mandirs/centers from official `baps.org` global network pages
- set `MANDIR_IMPORT_ENABLED=false` to skip the BAPS mandir import

## Operational Notes

### Telegram Bot

The current bot implementation supports:

- `/start`
- `/upcoming` for Telegram-linked admins and coordinators, scoped to their assigned airports
- phone-number or contact-share based record matching
- linking the same chat to matching passenger, user, and driver records when one person holds multiple roles
- accepting phone input with `+1`, spaces, or dashes
- dispatching queued notifications to Telegram chats

If `TELEGRAM_BOT_TOKEN` is missing, the bot does not poll Telegram and logs that it is running in scaffold mode.

### Scheduler

The scheduler runs every `SCHEDULER_TICK_MS` milliseconds and:

- scans upcoming transport tasks
- evaluates advanced reminder rules
- queues built-in flight and transport notification workflows
- dispatches SMS through Twilio when configured

## Lifecycle, Filters, And Notifications

### Itinerary Lifecycle

- Active itineraries remain visible in normal operations views.
- Cancelling an itinerary sets `status = CANCELLED` and archives it.
- Archived itineraries stay in the database but are hidden from the default overview, reminder scheduling, and `/upcoming`.
- Admins can hard delete an itinerary only when it was created incorrectly and should be removed permanently.

### Traveler And Driver Persistence

- Every itinerary traveler must resolve to a persisted `Passenger` row.
- Selecting a `User` or `Driver` as a traveler auto-resolves to an existing passenger when possible and auto-creates one when needed.
- Every assigned itinerary driver must be a persisted `Driver` row; inline driver creation in the trip builder is the intended path when a driver does not exist yet.

### Overview And Role Scoping

- `/` is the compact operations overview for upcoming itineraries.
- Admins can see all active itineraries in the web UI.
- Coordinators see only itineraries touching their assigned airports.
- Passengers see only their own itineraries.
- Admin and coordinator overview filters support `passenger` and `airport`.

### Built-In Notification Workflows

- Flight added, changed, cancelled, or deleted: Telegram to admins and coordinators assigned to affected airports.
- Pickup or dropoff assigned, changed, or cancelled: Telegram to assigned-airport admins and coordinators, SMS to itinerary passengers, and SMS to the assigned drivers for that task type.
- 48 hours before departure: Telegram to departure-airport admins and coordinators, SMS to itinerary passengers, and SMS to relevant drivers.
- 6 hours before departure: SMS to dropoff drivers only.
- 6 hours before arrival: SMS to pickup drivers only.
- Passenger/admin 48-hour reminders include accommodation details when present.

### Exports

Admin CSV exports are available for:

- trips and flights
- passengers
- drivers
- users

### Public Submission Flow

The public page at `/submission` accepts:

- submitter name and phone
- one or more passengers
- one or more flight segments
- optional notes

Those submissions are stored for admin/coordinator review. Staff then opens the submission in a full completion editor, adds booking/transport/accommodation details, and saves it into `/itineraries`. Reject and duplicate-flag actions remain available during review.

### Google Sheets Sync

- The app supports an authenticated hourly snapshot sync from Google Apps Script at `POST /api/sync/google-sheets`.
- Set `GOOGLE_SHEETS_SYNC_SECRET` in the app environment and send the same value in the `x-sync-secret` header from Apps Script.
- The checked-in Apps Script starter file is [scripts/google-sheets-sync.gs](/Users/sadhuvinamrajivandas/West Santo Travel /scripts/google-sheets-sync.gs).
- The sync is intended for one-row-per-passenger sheets and groups rows into trips before pushing them into the app.
- For already-synced trips, flight and locator changes apply automatically from the sheet.
- Passenger and driver database records stay app-owned; the sync uses conservative fuzzy matching for minor sheet-name errors and does not rename stored records.
- If an existing synced trip’s traveler or pickup/dropoff driver roster differs from the sheet, the app stages that change for review instead of auto-applying it. Staff can approve the staged roster from the itinerary edit screen.
- Missing trips from the latest sheet snapshot are archived as cancelled itineraries instead of being deleted.

## Known Gaps And Next Useful Slices

The most valuable next product slices, based on the codebase as it exists now, are:

- stronger submission review and duplicate-handling workflows
- dedicated itinerary list polish and deeper scoped coordinator workflows
- richer coordinator workflow around scoped visibility and editing
- Telegram driver response actions for assignment acceptance and status updates
- broader automated notification templates tied to more operational events
- stronger automated tests across API routes and repository flows

## Deployment Notes

- This project is designed to run cleanly through Docker Compose first.
- For non-local environments, set `APP_BASE_URL`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_BETTER_AUTH_URL` to the real public origin.
- Keep Google OAuth redirect URIs aligned with the deployed web URL.
- Treat `BETTER_AUTH_SECRET`, Google client secret, and Telegram bot token as production secrets.

## Short Project Definition

West Santo Travel is a Docker-first operations system for managing santo travel, airport transport, staff access, and reminders. The current repository already supports the core travel and admin workflows, and it is structured to grow into richer Telegram and review tooling without changing the overall architecture.
