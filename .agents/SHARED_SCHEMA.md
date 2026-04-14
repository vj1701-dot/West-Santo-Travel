# Shared Schema Snapshot

Primary schema file:
- `prisma/schema.prisma`

High-value models already present:
- `User`
- `Passenger`
- `Airport`
- `Mandir`
- `Itinerary`
- `FlightSegment`
- `Accommodation`
- `TransportTask`
- `TransportTaskDriver`
- `ApprovalRequest`
- `PublicSubmission`
- `DuplicateFlag`
- `NotificationLog`
- `AuditLog`
- `AiQueryLog`

Current mismatch versus frontend:
- many models exist in Prisma but are not surfaced in UI or API
- current admin UI only edits users, passengers, itineraries, and flight segments
- `PublicSubmission` exists but is not used
- `Accommodation` exists but has no CRUD UI/API
- booking/cost data exists but is not editable in frontend
