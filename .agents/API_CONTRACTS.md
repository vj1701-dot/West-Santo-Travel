# API Contracts

## Existing Routes

Protected:
- `GET /api/dashboard`
- `GET /api/airports`
- `GET /api/approvals`
- `POST /api/approvals/:id/review`
- `GET /api/itineraries`
- `POST /api/itineraries`
- `GET /api/itineraries/:id`
- `PATCH /api/itineraries/:id`
- `POST /api/itineraries/:id/segments`
- `GET /api/passengers`
- `POST /api/passengers`
- `PATCH /api/passengers/:id`
- `GET /api/transport-tasks`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`

Public:
- `POST /api/bot/link-telegram`
- `GET|POST /api/auth/[...nextauth]`

## Missing High-Priority Routes

- `POST /api/public-submissions`
- `GET /api/public-submissions`
- `POST /api/public-submissions/:id/approve`
- `POST /api/public-submissions/:id/reject`
- `POST /api/transport-tasks/:id/assign-driver`
- `POST /api/transport-tasks/:id/status`
- `GET /api/reports/costs`
- `GET /api/reports/export`

## Route Conventions

- JSON envelope:
  - success: `{ "data": ... }`
  - error: `{ "error": { "code": string, "message": string } }`
- Auth:
  - browser routes redirect to sign-in or access denied
  - API routes return `401` or `403`
