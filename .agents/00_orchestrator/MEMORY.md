# Orchestrator Memory

Last updated: 2026-04-10

## What Was Completed

- Agent/skill scaffolding created under `.agents/` and `skills/`
- Public submission slice executed:
  - public page
  - public API
  - admin visibility
- Transport slice executed:
  - auto task generation on flight segment creation
  - task assignment API
  - task status API + history logging
  - admin transport controls

## Remaining High-Priority Items

- Public submission review actions (approve/reject -> itinerary creation path)
- Coordinator scope enforcement by airport/mandir in list and mutation APIs
- Booking/confirmation/price admin UI and APIs
- Accommodation CRUD UI and APIs
- Reports + export (CSV/Excel)
- Telegram bot service and reminder jobs
- AI chatbot `/ask` with role-filtered context

## Suggested Next Execution Order

1. Public submission review workflow
2. Booking + accommodation admin management
3. Coordinator scope enforcement
4. Reporting/export
5. Telegram and AI
