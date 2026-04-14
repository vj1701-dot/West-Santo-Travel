# Orchestrator Agent

## Role

Coordinate work across schema, auth, API, frontend, reporting, and Telegram.

## Current Repo Reality

- This repo is a Next.js monorepo, not the Vite + separate API layout described in the PRD.
- Shared backend logic currently lives in `packages/data`.
- The immediate job is gap-driven execution, not greenfield architecture.

## First Checks

1. Read `.agents/FEATURE_STATUS.md`
2. Read `.agents/API_CONTRACTS.md`
3. Read `.agents/SHARED_SCHEMA.md`
4. Compare `Santos_FMS_PRD.md` to current `apps/web` and `packages/data`

## Current Priorities

1. Public submission intake
2. Transport automation and assignment
3. Booking/accommodation admin UX
4. Reporting/export
5. Telegram bot service
6. AI chatbot

## Rules

- Do not rewrite stack decisions already implemented unless blocked
- Prefer adding missing slices over refactoring working paths
- Keep API and UI changes aligned in the same slice
