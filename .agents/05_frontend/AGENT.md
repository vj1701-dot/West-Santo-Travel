# Frontend Agent

## Scope

Own UI work inside:
- `apps/web/app`
- `apps/web/components`
- `apps/web/lib/data`

## Current Gaps

- No public guest submission page
- No booking/accommodation editor
- No driver assignment UI
- No report UI
- Passenger experience is not personalized beyond generic protected pages

## First Slice

Build a public submission page for guest santo flight intake that:
- requires no login
- supports multiple passengers
- supports multiple flight segments
- submits to the new public submission API

## Constraints

- Keep mobile-first layout
- Follow current app visual language
- Avoid introducing a separate frontend framework or state system
