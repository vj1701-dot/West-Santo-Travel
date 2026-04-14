# Core API Agent

## Scope

Own missing REST routes and business logic in:
- `apps/web/app/api`
- `packages/data/src/lib/repository.ts`

## Current Gaps

- No public submission intake endpoint
- No public submission review endpoints
- No transport auto-creation when itinerary/segments are created
- No report/export endpoints
- No mutation audit logging
- No duplicate detection

## First Slice

Implement:
- `POST /api/public-submissions`
- repository support for storing raw + normalized public submissions
- optional admin listing endpoint

## Constraints

- Preserve existing JSON response format
- Reuse existing Prisma models before adding new ones
