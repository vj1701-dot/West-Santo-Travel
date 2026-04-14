# Public Submission Slice Skill

Use this skill when implementing guest santo flight intake.

## Goal

Create a no-login public submission workflow backed by the existing `PublicSubmission` Prisma model.

## Minimum Scope

1. Public page in `apps/web/app`
2. Public API route in `apps/web/app/api`
3. Repository helpers in `packages/data`
4. Admin visibility for submitted records

## Data Rules

- Store raw payload in `PublicSubmission.rawPayload`
- Store normalized payload in `PublicSubmission.normalizedPayload`
- Leave status as `PENDING` on create
- Do not auto-create itinerary in the first pass unless explicitly implementing approval

## UI Rules

- mobile-first
- supports multiple passengers
- supports multiple flight segments
- clear success/error state
