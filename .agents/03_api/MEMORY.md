# Core API Agent Memory

Last updated: 2026-04-10

## Completed

- Added `POST /api/public-submissions`
- Added `GET /api/public-submissions` (admin)
- Added `GET /api/drivers`
- Added `POST /api/transport-tasks/:id/assign`
- Added `POST /api/transport-tasks/:id/status`
- Added transport auto-task generation when adding flight segments
- Added task status history writes via `TransportTaskStatusHistory`

## Files Touched

- `packages/data/src/lib/repository.ts`
- `apps/web/app/api/public-submissions/route.ts`
- `apps/web/app/api/drivers/route.ts`
- `apps/web/app/api/transport-tasks/[id]/assign/route.ts`
- `apps/web/app/api/transport-tasks/[id]/status/route.ts`

## Remaining

- Public submission review endpoints:
  - approve
  - reject
- Auto-create itinerary from approved submission
- Duplicate detection before insert
- Audit log writes for all non-trivial mutations
- Pagination + filters on large list endpoints
