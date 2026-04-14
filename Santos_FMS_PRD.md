# Santos West Region Flight Management System
## Product Requirements Document + AI Agent Architecture
**Version:** 1.0  
**Date:** April 2026  
**Status:** Ready for Development

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Data Model](#3-data-model)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Core Features](#5-core-features)
6. [Telegram Bot & Mini App](#6-telegram-bot--mini-app)
7. [AI Chatbot Integration](#7-ai-chatbot-integration)
8. [Notifications](#8-notifications)
9. [Reporting & Analytics](#9-reporting--analytics)
10. [AI Agent Architecture](#10-ai-agent-architecture)
11. [Agent Skills Reference](#11-agent-skills-reference)
12. [Agent Collaboration Protocol](#12-agent-collaboration-protocol)

---

## 1. Project Overview

### 1.1 Purpose
The Santos West Region Flight Management System (FMS) is a web application and Telegram-integrated platform for tracking inbound/outbound flights for Santos (saints) and managing their ground transport (pickups and drop-offs) across West Coast mandirs.

### 1.2 Core Problems Solved
- Replace manual Google Sheets coordination for flight tracking
- Give coordinators a real-time view of arrivals/departures at their assigned airports
- Automate driver (Sevak) notifications via Telegram
- Give Admins cost visibility and exportable reports
- Allow passengers (Santos) to see their own itinerary and pickup details

### 1.3 Terminology
| UI Label | Internal Role |
|---|---|
| Passenger | Santo / traveler |
| Driver | Transport Sevak |
| Coordinator | Transport Coordinator |
| Accommodation | Mandir Stay |
| Itinerary | Trip record |

### 1.4 Scale & Deployment
- ~5 flights/week, ~100 passengers, ~15 coordinators
- Self-hosted on Windows Server via Docker
- PostgreSQL database
- Telegram Bot + Telegram Mini App (primary interface)
- Desktop web portal (secondary)

---

## 2. System Architecture

### 2.1 Technology Stack
```
Frontend:       React (Vite) — Mobile-first, runs as Telegram Mini App
Backend:        Node.js (Fastify or Express) REST API
Database:       PostgreSQL via Prisma ORM
Auth:           Keycloak (open-source OAuth) — easiest self-hosted option
Telegram:       Telegraf.js bot framework
Notifications:  Telegram Bot API
Deployment:     Docker Compose on Windows Server
AI Chatbot:     Claude API (read-only, Telegram-integrated)
```

### 2.2 Docker Services
```yaml
services:
  db:          PostgreSQL 16
  keycloak:    Keycloak 24 (auth)
  api:         Node.js backend
  frontend:    React (served via Nginx)
  bot:         Telegram bot service
  pgadmin:     (dev only)
```

### 2.3 Timezone Rules
- All times stored in **UTC**
- Displayed in **airport local timezone** (using IANA tz codes per airport)
- PST/PDT handled automatically via DST-aware libraries (date-fns-tz)

---

## 3. Data Model

### 3.1 User
```
users
  id                UUID PK
  email             VARCHAR UNIQUE NOT NULL
  first_name        VARCHAR
  last_name         VARCHAR
  phone             VARCHAR
  telegram_id       VARCHAR (linked when user joins bot with same email)
  role              ENUM: ADMIN | COORDINATOR | PASSENGER
  is_active         BOOLEAN DEFAULT true
  created_at        TIMESTAMP
  updated_at        TIMESTAMP

user_airport_assignments     (for coordinators and admins)
  user_id           FK → users
  airport_code      VARCHAR (IATA)
  
user_mandir_assignments      (for coordinators and admins)
  user_id           FK → users
  mandir_id         FK → mandirs
```

### 3.2 Passenger (Santo)
```
passengers
  id                UUID PK
  user_id           FK → users (nullable — guest santos have no login)
  first_name        VARCHAR NOT NULL
  last_name         VARCHAR NOT NULL
  legal_name        VARCHAR (for ticket matching)
  email             VARCHAR
  phone             VARCHAR
  telegram_id       VARCHAR
  passenger_type    ENUM: WEST_SANTO | GUEST_SANTO | HARIBHAKTO | EXTRA_SEAT
  is_exst           BOOLEAN DEFAULT false
  linked_passenger_id FK → passengers (EXST linked to parent santo)
  notes             TEXT
  created_at        TIMESTAMP
```

### 3.3 Itinerary (Trip)
```
itineraries
  id                UUID PK
  title             VARCHAR (auto-gen: "SFO Arrival - [Date]")
  booking_ref       VARCHAR (admin-only)
  total_price       DECIMAL (admin-only)
  status            ENUM: CREATED | CONFIRMED | ASSIGNED | EN_ROUTE |
                          PICKED_UP | DROPPED_OFF | COMPLETED | CANCELLED
  notes             TEXT
  submitted_via     ENUM: ADMIN | COORDINATOR | PUBLIC_FORM
  pending_approval  BOOLEAN DEFAULT false
  created_by        FK → users
  approved_by       FK → users (nullable)
  created_at        TIMESTAMP
  updated_at        TIMESTAMP

itinerary_passengers
  itinerary_id      FK → itineraries
  passenger_id      FK → passengers
  cost_share        DECIMAL (auto-calc or manual override)
  seat_class        VARCHAR
```

### 3.4 Flight Segment
```
flight_segments
  id                UUID PK
  itinerary_id      FK → itineraries
  airline           VARCHAR
  flight_number     VARCHAR
  departure_airport VARCHAR (IATA)
  arrival_airport   VARCHAR (IATA)
  departure_time    TIMESTAMP (UTC stored)
  arrival_time      TIMESTAMP (UTC stored)
  segment_order     INT
  notes             TEXT
```

### 3.5 Transport Task
```
-- Separate records for pickup and dropoff
transport_tasks
  id                UUID PK
  itinerary_id      FK → itineraries
  segment_id        FK → flight_segments
  task_type         ENUM: PICKUP | DROPOFF
  airport           VARCHAR (IATA)
  mandir_id         FK → mandirs
  status            ENUM: UNASSIGNED | ASSIGNED | ACCEPTED | EN_ROUTE |
                          COMPLETED | DECLINED | CANCELLED
  notes             TEXT
  created_at        TIMESTAMP

transport_task_sevaks    (multiple sevaks per task)
  task_id           FK → transport_tasks
  passenger_id      FK → passengers (sevak — a Driver is also in passengers table)
  
-- OR use a separate drivers table (recommended)
drivers
  id                UUID PK
  name              VARCHAR
  phone             VARCHAR
  telegram_id       VARCHAR
  telegram_username VARCHAR
  airports          VARCHAR[] (assigned airport codes)
  notes             TEXT
  created_at        TIMESTAMP

transport_task_drivers
  task_id           FK → transport_tasks
  driver_id         FK → drivers
  status            ENUM: PENDING | ACCEPTED | DECLINED | COMPLETED
  responded_at      TIMESTAMP
```

### 3.6 Mandir & Stay
```
mandirs
  id                UUID PK
  name              VARCHAR NOT NULL
  city              VARCHAR
  airport_code      VARCHAR (primary serving airport)
  region            VARCHAR DEFAULT 'WEST'

mandir_stays
  id                UUID PK
  itinerary_id      FK → itineraries
  passenger_id      FK → passengers
  mandir_id         FK → mandirs
  room              VARCHAR
  check_in_date     DATE
  check_out_date    DATE
  notes             TEXT
```

### 3.7 Audit Log
```
audit_logs
  id                UUID PK
  user_id           FK → users
  action            VARCHAR (e.g., ITINERARY_EDIT, TASK_ASSIGNED)
  entity_type       VARCHAR
  entity_id         UUID
  old_value         JSONB
  new_value         JSONB
  ip_address        VARCHAR
  device_info       VARCHAR
  telegram_action   BOOLEAN DEFAULT false
  created_at        TIMESTAMP
```

---

## 4. User Roles & Permissions

### 4.1 Permission Matrix

| Feature | Admin | Coordinator | Passenger | Driver (Telegram) |
|---|---|---|---|---|
| Create Itinerary | ✅ | ✅ (pending approval) | ❌ | ❌ |
| Edit Any Field | ✅ | ✅ (pending approval for flights) | ❌ | ❌ |
| View All Itineraries | ✅ | Their airport/mandir only | Own only | Assignment only |
| View Booking Ref / Price | ✅ | ❌ | ❌ | ❌ |
| Assign Transport | ✅ | Their airport only | ❌ | ❌ |
| Approve Changes | ✅ | ❌ | ❌ | ❌ |
| Export Reports | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Accept/Decline Task | ❌ | ❌ | ❌ | ✅ via Telegram |
| Mark Pickup/Dropoff | ❌ | ❌ | ❌ | ✅ via Telegram |
| AI Chatbot | ✅ | ✅ | ❌ | ❌ |

### 4.2 Authentication Flow
1. Admin creates user account in web app (email + role)
2. User logs in via Keycloak OAuth (Google/email SSO)
3. If email not pre-approved → access denied
4. User opens Telegram bot → bot asks for email
5. Email matched to DB → Telegram ID linked automatically
6. Bot shows role-appropriate menu

### 4.3 Admin Ownership
- Admins are assigned to specific **airports** and **mandirs**
- Approval requests for flight edits → routed to **any available admin** (first-come-first-approve)
- All admins can see everything but are "primary" for their assignments

---

## 5. Core Features

### 5.1 Itinerary Management

**Admin/Coordinator Create Flow:**
1. Create itinerary → add flight segments (multi-leg supported)
2. Add passengers to itinerary → set passenger_type per traveler
3. EXST flag: checkbox on passenger row → cost included in linked santo
4. System auto-creates transport tasks for each segment that touches coordinator's airport(s)
5. Mandir auto-suggested based on arrival airport mapping (admin confirms)

**Public Submission Form (Open Link):**
- No login required
- Fields: submitter name, passenger list (name + phone + type), flight segments, notes
- Goes into **admin approval queue** (pending_approval = true)
- Submitter receives confirmation message (no status tracking link)
- Admin reviews → approve/reject/edit

**Approval Workflow (Coordinator Edits):**
```
Coordinator submits edit
  → itinerary.pending_approval = true
  → Telegram notification to eligible admins (assigned to same airport/mandir)
  → First admin to tap "Approve" applies changes
  → Coordinator notified of result
```

### 5.2 Transport Task Assignment

**Coordinator assigns driver:**
1. View unassigned transport tasks for their airport
2. Select driver(s) from dropdown (can add multiple per task)
3. Driver receives Telegram notification immediately
4. Driver accepts/declines via Telegram
5. Coordinator receives status update
6. If driver declines or no Telegram → coordinator manually contacts

**Status Progression:**
```
UNASSIGNED → ASSIGNED → ACCEPTED (driver confirms) → EN_ROUTE → COMPLETED
                      ↘ DECLINED (driver rejects, back to coordinator)
```

### 5.3 Guest Santo Handling
- Any traveler can be added without requiring login
- Email not required for guest santos
- Admin can optionally link guest to Telegram manually via bot
- Guest santos appear in all reports and transport tasks normally

### 5.4 Transport Scope Rule
> A transport task is created when a **flight segment's arrival or departure airport** matches a coordinator's assigned airport(s).

```
Example: NYC → LAX → SFO
  - LAX coordinator sees: arrival task (NYC→LAX) + departure task (LAX→SFO)
  - SFO coordinator sees: arrival task (LAX→SFO) only
```

### 5.5 Cost Model
```
Itinerary: total_price = $900 (admin enters)
Passengers: Santo A, Santo B, EXST (linked to Santo A)

Auto-split: $900 / 2 (non-EXST passengers) = $450 each
EXST cost: included in Santo A's $450 (not a separate line)
Manual override: Admin can set custom per-passenger cost
Reports show: Individual cost + booking total
```

---

## 6. Telegram Bot & Mini App

### 6.1 Bot Architecture (One Bot, Role-Aware)
- Single bot for all users
- On /start → bot asks for email → links to account
- Role detected from DB → different menus shown per role
- Mini App button in bot menu → opens full web dashboard

### 6.2 Driver Bot Flows
```
[New Assignment]
Bot: "🚗 New Pickup Task
  Santo: Ramesh Patel
  Airport: LAX - Terminal 3
  Flight: AA 456 arriving 3:45 PM
  Drop-off: Chino Hills Mandir
  
  [✅ Accept] [❌ Decline]"

[Accepted → Reminder sent 2hr before]
Bot: "⏰ Reminder: Pickup in 2 hours
  Santo: Ramesh Patel | AA456 lands 3:45 PM"

[Driver updates status]
Bot shows inline buttons:
  [🚙 On the Way] → [✅ Picked Up] → [🏁 Dropped Off]
```

### 6.3 Coordinator Bot Flows
- Receives all transport status updates for their airports
- Gets alerts for unassigned tasks 24hr before flight
- AI Chatbot accessible via /ask command
- Can open Mini App directly from bot

### 6.4 Passenger Bot Flows
- Flight reminders (24hr, 2hr before)
- Pickup details (driver name + phone) once assigned
- If driver has no Telegram, coordinator's contact info shown instead

### 6.5 Notification Triggers

| Event | Admin | Coordinator | Passenger | Driver |
|---|---|---|---|---|
| New task created | ✅ (their airport) | ✅ | ❌ | ❌ |
| Task assigned to driver | ✅ | ✅ | ❌ | ✅ |
| Driver accepts | ✅ | ✅ | ✅ (with driver contact) | ❌ |
| Driver declines | ✅ | ✅ | ❌ | ❌ |
| 24hr flight reminder | ✅ | ✅ | ✅ | ✅ (if assigned) |
| 2hr flight reminder | ✅ | ✅ | ✅ | ✅ |
| Unassigned 24hr warning | ✅ | ✅ | ❌ | ❌ |
| Edit pending approval | ✅ | ❌ | ❌ | ❌ |
| Status update | ✅ | ✅ | ✅ | ❌ |

### 6.6 Telegram Mini App
- Full web app embedded in Telegram (no reduced UI)
- Mobile-first card-based design
- Priority: Mobile-first cards → Filters → Search → Dense tables

---

## 7. AI Chatbot Integration

### 7.1 Scope
- Read-only database Q&A assistant
- Accessible via Telegram bot (/ask command) for Admins and Coordinators only
- Powered by Claude API

### 7.2 Example Queries
```
Admin:
  "Who is arriving tomorrow at LAX?"
  "Show me all unassigned pickups this week"
  "What's the total cost for Pramukh Swami trip in March?"
  "How many flights last month for Chino Hills mandir?"

Coordinator:
  "Which santos need pickup at SFO on Friday?"
  "Is there a driver assigned for the 5pm LAX arrival?"
  "Show pending approvals for my airports"
```

### 7.3 Access Control for AI
- Chatbot authenticates via service account (backend API key)
- Respects role: if Coordinator asks, filters results by their airports/mandirs
- **Never exposes**: booking confirmation numbers, prices to non-admins
- Read-only: no mutations possible via chatbot

### 7.4 Implementation
```javascript
// Bot command handler
bot.command('ask', async (ctx) => {
  const user = await getUserByTelegramId(ctx.from.id);
  if (!['ADMIN', 'COORDINATOR'].includes(user.role)) return;
  
  const query = ctx.message.text.replace('/ask ', '');
  const dbContext = await fetchRelevantData(user, query); // role-filtered
  const response = await callClaudeAPI(query, dbContext, user.role);
  ctx.reply(response);
});
```

---

## 8. Notifications

### 8.1 Scheduled Jobs (Cron)
```
Every hour:
  - Check flights in next 24hrs → send 24hr reminders (if not already sent)
  - Check flights in next 2hrs  → send 2hr reminders (if not already sent)
  - Check transport tasks unassigned 24hrs before flight → alert coordinator + admin

Flags on transport_tasks:
  - reminder_24hr_sent: BOOLEAN
  - reminder_2hr_sent: BOOLEAN
```

### 8.2 Message Failure Handling
- Telegram send failures: log to DB, retry 3x with exponential backoff
- If driver has no Telegram ID: skip driver notification, notify coordinator with "Driver has no Telegram — please contact manually"

---

## 9. Reporting & Analytics

### 9.1 Admin Reports
| Report | Description | Export |
|---|---|---|
| Upcoming Arrivals | By date range, airport | Excel |
| Cost Report | Per passenger, per booking, per mandir | Excel |
| Transport Assignments | Sevak activity | Excel |
| Full Data Export | All tables filtered | Excel/CSV |
| Audit Log Export | Who changed what | CSV |

### 9.2 Custom Filters
- Date range
- Airport (IATA code)
- Mandir
- Passenger name / legal name
- Santo type (WEST / GUEST / HARIBHAKTO)

### 9.3 Duplicate Detection
System flags as duplicate if any of these match:
- Same passenger + same flight number + same date
- Same booking confirmation + same traveler
- Same legal name + same departure/arrival airports + flights within 2hrs

On detection: admin receives Telegram alert + flag shown in UI.

---

## 10. AI Agent Architecture

These agents are designed for **Claude Code** (or similar agentic frameworks). Each agent has a defined domain, reads from a `MEMORY.md` to track what's been built, and operates within its scope. They collaborate through a shared `CLAUDE.md` project constitution.

---

### Agent 0: Orchestrator Agent
**File:** `agents/00_orchestrator/AGENT.md`

**Role:** Master coordinator. Reads the full PRD, delegates tasks to domain agents, tracks completion, resolves conflicts between agents.

**Skills:**
- Read and interpret PRD
- Create and update task queues for other agents
- Detect blockers or conflicting decisions between agents
- Generate status reports across all agents
- Resolve merge conflicts in shared schema files

**On startup checklist:**
1. Read `CLAUDE.md` and all `MEMORY.md` files from each agent
2. Compare what's been built vs. PRD requirements
3. Identify gaps and create `TODO.md` for each agent
4. Confirm agent scope boundaries before delegation

**Forbidden:** Never writes application code directly. Only coordinates.

---

### Agent 1: Database & Schema Agent
**File:** `agents/01_schema/AGENT.md`

**Role:** Owns the PostgreSQL schema, Prisma models, migrations, and seed data.

**Skills:**
- Read existing `prisma/schema.prisma` and compare to PRD data model
- Generate new models, relations, enums
- Write migration files without breaking existing data
- Generate seed scripts for mandirs, airports, test users
- Validate referential integrity rules

**On startup — check these files:**
```
prisma/schema.prisma       → compare against Section 3 of PRD
prisma/migrations/         → review migration history
prisma/seed.ts             → check existing seed data
```

**What to look for:**
- Missing tables: `audit_logs`, `mandir_stays`, `transport_task_drivers`
- Missing enums: `passenger_type`, `task_type`, `itinerary_status`
- Missing fields: `is_exst`, `legal_name`, `linked_passenger_id`
- Timezone: confirm all `TIMESTAMP` fields store UTC
- Check if `drivers` table exists separately from `passengers`

**Outputs:**
- Updated `prisma/schema.prisma`
- Migration SQL files
- Seeder for airports and mandirs

---

### Agent 2: Auth & User Management Agent
**File:** `agents/02_auth/AGENT.md`

**Role:** Owns authentication, Keycloak setup, role management, and user provisioning.

**Skills:**
- Inspect Keycloak configuration (realm, clients, roles)
- Check existing API auth middleware
- Write/fix JWT verification middleware
- Implement role-based access control (RBAC) guard decorators
- Build admin user management endpoints (create/edit/assign role)

**On startup — check these files:**
```
docker-compose.yml          → is Keycloak defined? ports? realm config?
api/middleware/auth.ts       → does JWT verification exist?
api/routes/users/            → admin user management endpoints
keycloak/realm-export.json  → roles defined? (ADMIN/COORDINATOR/PASSENGER)
```

**What to look for:**
- Is Keycloak configured with correct client for the frontend?
- Are roles (`ADMIN`, `COORDINATOR`, `PASSENGER`) defined in Keycloak realm?
- Does middleware extract `user.role` from JWT and pass to request context?
- Is there an endpoint for admin to create users and assign roles?
- Is access denied for unknown emails (no open self-registration)?

**Outputs:**
- Working Keycloak realm export
- Auth middleware with role guards
- Admin user management endpoints (CRUD + role assignment)

---

### Agent 3: Core API Agent
**File:** `agents/03_api/AGENT.md`

**Role:** Owns all REST API routes for itineraries, passengers, flights, transport tasks, mandirs.

**Skills:**
- Audit existing route files vs. PRD feature list
- Add missing endpoints
- Implement approval workflow logic (pending_approval flow)
- Add pagination to all list endpoints
- Implement duplicate detection logic

**On startup — check these files:**
```
api/routes/                  → what routes exist?
api/routes/itineraries/      → CRUD, approval endpoints?
api/routes/transport/        → task assignment, status updates?
api/routes/passengers/       → create, list, types?
api/routes/reports/          → export endpoints?
api/services/                → business logic layer?
```

**What to look for:**
- Is there an approval flow? (`PATCH /itineraries/:id/approve`)
- Is there a public submission endpoint (no auth) for guest form?
- Do list endpoints have `?page=&limit=` pagination?
- Is transport task creation automated when itinerary is created?
- Is cost split calculation implemented?
- Is duplicate detection implemented pre-insert?
- Are audit log writes happening on every mutation?

**Outputs:**
- Complete route coverage per PRD
- Approval workflow implementation
- Duplicate detection service
- Audit log middleware

---

### Agent 4: Telegram Bot Agent
**File:** `agents/04_telegram/AGENT.md`

**Role:** Owns the Telegram bot — commands, flows, notifications, role-based menus, and Mini App launch.

**Skills:**
- Read existing bot command handlers
- Identify missing commands or broken flows
- Build role-detection on /start (email matching)
- Implement driver Accept/Decline/Status flow with inline keyboards
- Set up bot menu with Mini App button
- Write notification send functions

**On startup — check these files:**
```
bot/index.ts                  → bot setup, webhook or polling?
bot/commands/                 → existing /start, /help, /ask handlers?
bot/flows/                    → driver assignment flow?
bot/notifications/            → notification functions for each trigger?
bot/middleware/               → user lookup by telegram_id?
```

**What to look for:**
- On /start: does bot ask for email and match to DB?
- Does bot show different menus based on role?
- Is there an inline keyboard for driver: Accept/Decline?
- Are status update buttons (On the Way / Picked Up / Dropped Off) implemented?
- Does bot handle the case where driver has no Telegram?
- Is the Mini App URL configured in bot menu?
- Is /ask command gated to ADMIN/COORDINATOR only?

**Outputs:**
- Full bot command and flow handlers
- Notification service functions
- Mini App menu configuration

---

### Agent 5: Frontend Agent
**File:** `agents/05_frontend/AGENT.md`

**Role:** Owns the React frontend — all dashboards, forms, and Telegram Mini App compatibility.

**Skills:**
- Audit existing pages and components
- Build or fix role-specific dashboards
- Implement mobile-first card layouts
- Build the public guest submission form
- Implement filter/search UI
- Ensure Telegram Mini App compatibility (viewport, scrolling)

**On startup — check these files:**
```
frontend/src/pages/           → what pages exist?
frontend/src/pages/Admin/     → admin dashboard, reports, user mgmt?
frontend/src/pages/Coordinator/ → coordinator dashboard, assignment UI?
frontend/src/pages/Passenger/ → passenger view, pickup details?
frontend/src/pages/PublicForm/ → guest submission form?
frontend/src/components/      → shared components?
frontend/src/hooks/auth.ts    → Keycloak integration?
```

**What to look for:**
- Is there a working Keycloak login integration in React?
- Does each role see the correct dashboard after login?
- Is the coordinator's transport assignment UI built?
- Is the public submission form accessible without login?
- Are tables paginated?
- Are all dashboards mobile-responsive?
- Is Telegram Mini App viewport meta tag set correctly?

**Outputs:**
- Complete dashboard per role
- Transport assignment UI
- Guest submission form
- Mobile-first responsive design

---

### Agent 6: Reporting Agent
**File:** `agents/06_reports/AGENT.md`

**Role:** Owns all reporting, data export, and analytics features.

**Skills:**
- Check existing report endpoints and frontend pages
- Build cost report (per passenger + per booking)
- Build Excel export (using ExcelJS or similar)
- Build CSV export for audit logs
- Implement custom filter logic in API

**On startup — check these files:**
```
api/routes/reports/           → existing report endpoints
api/services/reportService.ts → business logic?
frontend/src/pages/Reports/   → report UI?
```

**What to look for:**
- Is there a cost report with per-passenger breakdown?
- Is there an Excel export endpoint?
- Can admin filter reports by date range, airport, mandir, passenger?
- Is audit log exported to CSV?
- Does the EXST cost correctly roll up into linked santo's cost?

**Outputs:**
- Cost report API and UI
- Excel export service
- Audit log CSV export

---

### Agent 7: AI Chatbot Agent
**File:** `agents/07_chatbot/AGENT.md`

**Role:** Owns the read-only AI Q&A assistant integrated into the Telegram bot.

**Skills:**
- Check existing /ask command implementation
- Build a context fetcher that pulls relevant DB data based on query
- Call Claude API with structured prompt + DB context
- Enforce read-only and role-filtered access
- Handle Telegram message length limits (split long responses)

**On startup — check these files:**
```
bot/commands/ask.ts            → /ask handler exists?
api/services/chatbotService.ts → context builder?
api/services/claudeService.ts  → Claude API call wrapper?
```

**What to look for:**
- Is /ask command restricted to ADMIN and COORDINATOR only?
- Does context builder filter data by user's assigned airports/mandirs?
- Are booking confirmation numbers excluded from coordinator context?
- Are API calls made with `claude-sonnet-4-20250514`?
- Is there graceful handling for empty results or Claude API errors?
- Does response splitting work for Telegram's 4096 char limit?

**Outputs:**
- Role-aware context builder
- Claude API integration
- Telegram /ask command handler

---

## 11. Agent Skills Reference

Each agent reads these shared files before doing any work:

```
CLAUDE.md                    — Project constitution, absolute rules, stack decisions
agents/SHARED_SCHEMA.md      — Latest DB schema snapshot (updated by Schema Agent)
agents/API_CONTRACTS.md      — Endpoint specs (updated by API Agent)
agents/FEATURE_STATUS.md     — What's done, what's pending (updated by Orchestrator)
```

### Shared Skills (All Agents)
- **Read before write**: Always check existing code before creating new files
- **Incremental**: Make small targeted changes, not full rewrites
- **Leave breadcrumbs**: Update own `MEMORY.md` after every session
- **No silent assumptions**: If a decision isn't in PRD, log it in `DECISIONS.md` before implementing

### Agent-Specific Skill Tags
| Skill Tag | Agents |
|---|---|
| `skill:db-migration` | Schema |
| `skill:auth-middleware` | Auth |
| `skill:api-crud` | Core API |
| `skill:approval-flow` | Core API, Telegram |
| `skill:telegram-flow` | Telegram |
| `skill:notification` | Telegram |
| `skill:react-dashboard` | Frontend |
| `skill:mini-app-compat` | Frontend |
| `skill:excel-export` | Reporting |
| `skill:ai-context-builder` | AI Chatbot |

---

## 12. Agent Collaboration Protocol

### 12.1 Startup Sequence
```
1. Orchestrator reads FEATURE_STATUS.md
2. Orchestrator pings each agent with: "Check your domain. Report gaps."
3. Schema Agent runs first (others depend on it)
4. Auth Agent runs second (API Agent needs auth middleware)
5. Core API Agent runs third
6. Telegram, Frontend, Reporting, AI Chatbot run in parallel
7. Orchestrator does final integration check
```

### 12.2 Conflict Resolution
- Schema changes: Schema Agent owns. Others request changes via `schema_change_requests.md`
- API contracts: Core API Agent owns. Frontend/Bot agents reference `API_CONTRACTS.md`
- Shared utilities: Any agent can add to `api/utils/` but must document in `SHARED_UTILS.md`

### 12.3 MEMORY.md Template (Per Agent)
```markdown
# [Agent Name] Memory

## Last Updated: [Date]

## What I've Checked
- [file path]: [what I found]

## What I've Built / Changed
- [feature]: [what was done]

## Pending / Blocked
- [item]: [blocker]

## Decisions Made
- [decision]: [reasoning]

## Handoff Notes for Other Agents
- Schema Agent: [note if needed]
- API Agent: [note if needed]
```

### 12.4 Known Gaps to Resolve First (From PRD Analysis)
The following were flagged as missing/underspecified — agents should address these before feature work:

| Gap | Assigned Agent | Priority |
|---|---|---|
| Region model not defined (just use airport codes) | Schema | HIGH |
| Airport ↔ Mandir mapping table | Schema | HIGH |
| Keycloak config in Docker | Auth | HIGH |
| Telegram email linking flow | Telegram + Auth | HIGH |
| Transport task auto-creation on itinerary save | Core API | HIGH |
| Cancellation cascade (tasks auto-cancel) | Core API | MEDIUM |
| Driver conflict detection (overlapping times) | Core API | LOW |
| Telegram message retry logic | Telegram | MEDIUM |
| AI chatbot role-filtered context | AI Chatbot | MEDIUM |

---

*End of PRD — Santos West Region Flight Management System v1.0*
