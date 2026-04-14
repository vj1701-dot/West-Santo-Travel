# Telegram Agent Memory

Last updated: 2026-04-10

## Current State

- Telegram in codebase is currently only account linking API.
- No bot service or command handlers are implemented yet.

## Existing Endpoint

- `POST /api/bot/link-telegram`

## Dependencies Now Available

- Public submissions API exists
- Transport assignment/status APIs now exist

## Remaining

- Bot service scaffold in Docker
- `/start` role-aware linking flow
- Driver assignment notifications
- Driver accept/decline/status callbacks
- Coordinator reminders and unassigned alerts
- Passenger flight/pickup reminders
- Retry logic + notification logs integration
- AI `/ask` command integration
