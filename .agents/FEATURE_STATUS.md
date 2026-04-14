# Feature Status

Last updated: 2026-04-10

## Implemented

- Next.js web app with protected routes and Keycloak/OIDC login
- Local database as authorization source of truth
- Admin frontend for:
  - users
  - passengers
  - itineraries
  - flight segments
- Dashboard pages for:
  - overview
  - itineraries
  - transport tasks
  - approvals
  - passengers
- Prisma schema includes:
  - approvals
  - transport tasks
  - drivers
  - accommodations
  - bookings
  - public submissions
  - duplicates
  - notification logs
  - audit logs
  - AI query logs
- Docker stack includes:
  - app db
  - isolated Keycloak db
  - isolated Keycloak
  - web app

## Partially Implemented

- Approval workflow:
  - approval records exist
  - approval review API exists
  - coordinator edit workflow is not complete in UI
- Role-aware access:
  - admin/user auth exists
  - coordinator airport/mandir scoping is not enforced in app behavior
- Reporting:
  - core data exists
  - no reporting UI or export endpoints

## Missing From PRD

- Public guest submission form and intake API
- Public submission review UI
- Automatic transport task creation when flight segments are added
- Cancellation cascade for transport tasks
- Driver assignment UI
- Driver accept/decline/status workflow
- Telegram bot service and notification jobs
- Passenger self-service itinerary/pickup view scoped to linked user
- Booking ref / total price editing in frontend
- Mandir/accommodation management UI
- Custom reports and Excel/CSV export
- Duplicate detection before insert
- Audit log writes on mutations
- AI chatbot service and Telegram `/ask`

## Suggested Execution Order

1. Public submission intake
2. Transport auto-creation and assignment workflow
3. Booking/accommodation admin UI
4. Reporting/export
5. Telegram bot and notifications
6. AI chatbot
