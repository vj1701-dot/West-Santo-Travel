# api-contract.md

# West Region Santos Flight Management System
## API Contract (Endpoints + Payloads)

This document defines the recommended REST API contract for the backend. It is intended to unlock:
- frontend implementation
- Telegram bot integration
- worker/service orchestration
- approval and audit behavior

---

# 1. API Design Principles

- REST-first
- JSON payloads
- role-based authorization enforced in backend
- pagination on list endpoints
- filters for operational views
- bot uses same backend APIs as web app where practical
- all important writes create audit logs
- coordinator flight-related writes may create pending approvals instead of immediate updates

---

# 2. Authentication

## 2.1 Auth model
Use OIDC/JWT via Keycloak or equivalent.

The frontend obtains token and sends:

```http
Authorization: Bearer <token>
```

The backend extracts:
- user id
- email
- role

The backend must still verify that user is active and role is valid in local DB.

---

# 3. Common Response Patterns

## 3.1 Success object
```json
{
  "data": {}
}
```

## 3.2 Pagination object
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

## 3.3 Error object
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource."
  }
}
```

---

# 4. Identity Linking / Telegram APIs

# 4.1 Link Telegram Account
Used by bot after `/start`.

```http
POST /bot/link-telegram
```

### Request
```json
{
  "chatId": "123456789",
  "telegramUsername": "optional_username",
  "input": "user@example.com or (555) 222-1111"
}
```

### Backend behavior
- normalize input
- match email exactly first
- match phone second
- update matched user/passenger/driver record as appropriate
- create audit log

### Success response
```json
{
  "data": {
    "linked": true,
    "role": "COORDINATOR",
    "displayName": "John Patel"
  }
}
```

### Failure response
```json
{
  "error": {
    "code": "NO_MATCH",
    "message": "No matching account found."
  }
}
```

---

# 5. Users / Access APIs

# 5.1 List Users
```http
GET /users?page=1&pageSize=20&role=COORDINATOR&search=john
```

Admin only.

# 5.2 Create User
```http
POST /users
```

### Request
```json
{
  "email": "john@example.com",
  "phone": "5551112222",
  "firstName": "John",
  "lastName": "Patel",
  "role": "COORDINATOR"
}
```

# 5.3 Update User
```http
PATCH /users/:id
```

# 5.4 Assign Admin Airports
```http
POST /users/:id/admin-airports
```

```json
{
  "airportIds": ["uuid1", "uuid2"]
}
```

# 5.5 Assign Admin Mandirs
```http
POST /users/:id/admin-mandirs
```

# 5.6 Assign Coordinator Airports
```http
POST /users/:id/coordinator-airports
```

# 5.7 Assign Coordinator Mandirs
```http
POST /users/:id/coordinator-mandirs
```

---

# 6. Passenger APIs

# 6.1 List Passengers
```http
GET /passengers?page=1&pageSize=20&search=swami
```

Admin and coordinator by scope.

# 6.2 Create Passenger
```http
POST /passengers
```

### Request
```json
{
  "firstName": "Swami",
  "lastName": "A",
  "legalName": "Swami A",
  "email": null,
  "phone": "5553334444",
  "passengerType": "GUEST_SANTO",
  "linkedPrimaryPassengerId": null,
  "notes": "Guest santo"
}
```

# 6.3 Update Passenger
```http
PATCH /passengers/:id
```

# 6.4 Link Passenger to User
```http
POST /passengers/:id/link-user
```

```json
{
  "userId": "uuid"
}
```

---

# 7. Airport / Mandir / Mapping APIs

# 7.1 List Airports
```http
GET /airports
```

# 7.2 Create Airport
```http
POST /airports
```

# 7.3 List Mandirs
```http
GET /mandirs
```

# 7.4 Create Mandir
```http
POST /mandirs
```

# 7.5 List Airport-Mandir Mappings
```http
GET /airport-mandir-mappings
```

# 7.6 Create/Update Mapping
```http
POST /airport-mandir-mappings
```

```json
{
  "airportId": "uuid",
  "mandirId": "uuid",
  "isDefault": true
}
```

---

# 8. Itinerary APIs

# 8.1 List Itineraries
```http
GET /itineraries?page=1&pageSize=20&date=2026-05-12&airportId=uuid&mandirId=uuid&status=CREATED&search=swami
```

### Visibility rules
- admin: full
- coordinator: scoped
- passenger: own only

# 8.2 Get Itinerary Detail
```http
GET /itineraries/:id
```

### Response shape
```json
{
  "data": {
    "id": "uuid",
    "status": "CREATED",
    "notes": "General trip note",
    "passengers": [],
    "booking": {},
    "segments": [],
    "accommodations": [],
    "transportTasks": [],
    "approvals": []
  }
}
```

# 8.3 Create Itinerary
```http
POST /itineraries
```

### Request
```json
{
  "notes": "West coast visit",
  "passengerIds": ["uuid1", "uuid2"]
}
```

### Behavior
- admin: create immediately
- coordinator: create itinerary; if flight-related fields come with it, may produce pending approval flow depending on implementation choice

# 8.4 Update Itinerary
```http
PATCH /itineraries/:id
```

### Request
```json
{
  "notes": "Updated general notes"
}
```

### Important
Coordinator changes that affect protected fields should create approval requests rather than immediate final mutation.

# 8.5 Cancel Itinerary
```http
POST /itineraries/:id/cancel
```

### Request
```json
{
  "reason": "Trip cancelled"
}
```

### Behavior
- set itinerary status to CANCELLED
- cancel related transport tasks
- send notifications
- audit log

---

# 9. Booking APIs

# 9.1 Create or Update Booking
```http
POST /itineraries/:id/booking
```

### Request
```json
{
  "confirmationNumber": "ABC123",
  "totalCost": 1200.00,
  "notes": "Group booking"
}
```

Admin only for confirmation visibility and cost editing unless you later open limited coordinator access.

# 9.2 Set Booking Allocations
```http
POST /bookings/:id/allocations
```

### Request
```json
{
  "allocations": [
    {
      "passengerId": "uuid1",
      "allocatedCost": 700.00,
      "isManualOverride": true
    },
    {
      "passengerId": "uuid2",
      "allocatedCost": 500.00,
      "isManualOverride": true
    }
  ]
}
```

# 9.3 Recalculate Equal Split
```http
POST /bookings/:id/recalculate-equal-split
```

---

# 10. Flight Segment APIs

# 10.1 Add Segment
```http
POST /itineraries/:id/segments
```

### Request
```json
{
  "segmentOrder": 1,
  "airline": "United",
  "flightNumber": "UA123",
  "departureAirportId": "uuid_ord",
  "arrivalAirportId": "uuid_lax",
  "departureTimeLocal": "2026-05-12T12:00:00",
  "arrivalTimeLocal": "2026-05-12T14:30:00",
  "notes": "Window seat"
}
```

### Behavior
- admin: immediate
- coordinator: should create pending approval if protected by approval workflow
- after approval/finalization, transport generation may run

# 10.2 Update Segment
```http
PATCH /segments/:id
```

### Request
```json
{
  "arrivalTimeLocal": "2026-05-12T15:10:00",
  "notes": "Time changed"
}
```

### Behavior
- same approval rules as above

# 10.3 Delete Segment
```http
DELETE /segments/:id
```

Use with caution; may require approval if coordinator initiated.

---

# 11. Accommodation APIs

# 11.1 Add Accommodation
```http
POST /itineraries/:id/accommodations
```

```json
{
  "mandirId": "uuid",
  "room": "Room 12",
  "checkInDate": "2026-05-12",
  "checkOutDate": "2026-05-14",
  "notes": "Near main hall"
}
```

# 11.2 Update Accommodation
```http
PATCH /accommodations/:id
```

# 11.3 Delete Accommodation
```http
DELETE /accommodations/:id
```

---

# 12. Transport APIs

# 12.1 List Transport Tasks
```http
GET /transport-tasks?page=1&pageSize=20&date=2026-05-12&airportId=uuid&status=UNASSIGNED&type=PICKUP
```

# 12.2 Get Transport Task Detail
```http
GET /transport-tasks/:id
```

# 12.3 Create Transport Task
Usually system-generated, but allow admin/manual creation if needed.

```http
POST /transport-tasks
```

# 12.4 Assign Drivers to Task
```http
POST /transport-tasks/:id/drivers
```

### Request
```json
{
  "driverIds": ["uuid1", "uuid2"]
}
```

### Behavior
- notify drivers
- notify coordinator/passenger/admin as configured
- audit log

# 12.5 Remove Driver from Task
```http
DELETE /transport-tasks/:id/drivers/:driverId
```

### Behavior
- notify removed driver if previously assigned
- audit log

# 12.6 Update Transport Task
```http
PATCH /transport-tasks/:id
```

### Request
```json
{
  "notes": "Meet at terminal 3",
  "scheduledTimeLocal": "2026-05-12T14:45:00"
}
```

---

# 13. Driver APIs

# 13.1 List Drivers
```http
GET /drivers?page=1&pageSize=20&search=harsh
```

# 13.2 Create Driver
```http
POST /drivers
```

```json
{
  "name": "Harsh Patel",
  "phone": "5554448888",
  "notes": "Available evenings"
}
```

# 13.3 Update Driver
```http
PATCH /drivers/:id
```

# 13.4 Assign Driver Airports
```http
POST /drivers/:id/airports
```

```json
{
  "airportIds": ["uuid_lax", "uuid_sfo"]
}
```

# 13.5 Driver My Assignments (bot-facing or future driver UI)
```http
GET /drivers/me/assignments
```

---

# 14. Approval APIs

# 14.1 List Approval Requests
```http
GET /approvals?page=1&pageSize=20&status=PENDING
```

Admin only.

# 14.2 Get Approval Detail
```http
GET /approvals/:id
```

# 14.3 Approve Request
```http
POST /approvals/:id/approve
```

```json
{
  "comment": "Looks good"
}
```

### Behavior
- apply proposed payload
- notify requester
- audit log

# 14.4 Reject Request
```http
POST /approvals/:id/reject
```

```json
{
  "comment": "Need correction"
}
```

---

# 15. Public Submission APIs

# 15.1 Create Public Submission
```http
POST /public-submissions
```

### Request
```json
{
  "passengers": [
    {
      "firstName": "Swami",
      "lastName": "A",
      "legalName": "Swami A"
    }
  ],
  "segments": [
    {
      "segmentOrder": 1,
      "airline": "United",
      "flightNumber": "UA123",
      "departureAirportCode": "ORD",
      "arrivalAirportCode": "LAX",
      "departureTimeLocal": "2026-05-12T12:00:00",
      "arrivalTimeLocal": "2026-05-12T14:30:00"
    }
  ],
  "notes": "Please arrange pickup"
}
```

### Behavior
- validate
- normalize
- duplicate check
- create pending review item
- notify relevant admins

# 15.2 List Public Submissions
```http
GET /public-submissions?page=1&pageSize=20&status=PENDING
```

Admin only.

# 15.3 Approve Public Submission
```http
POST /public-submissions/:id/approve
```

### Behavior
- create itinerary and related data
- preserve source link
- audit log

# 15.4 Reject Public Submission
```http
POST /public-submissions/:id/reject
```

---

# 16. Duplicate Review APIs

# 16.1 List Duplicate Flags
```http
GET /duplicate-flags?page=1&pageSize=20
```

# 16.2 Resolve Duplicate Flag
```http
POST /duplicate-flags/:id/resolve
```

```json
{
  "resolutionNote": "Reviewed and kept separate"
}
```

---

# 17. Reports APIs

# 17.1 Cost Report
```http
GET /reports/cost?startDate=2026-05-01&endDate=2026-05-31&airportId=uuid&mandirId=uuid
```

# 17.2 Upcoming Arrivals
```http
GET /reports/upcoming-arrivals?date=2026-05-12&airportId=uuid
```

# 17.3 Driver Activity
```http
GET /reports/driver-activity?startDate=2026-05-01&endDate=2026-05-31
```

# 17.4 Mandir Activity
```http
GET /reports/mandir-activity?startDate=2026-05-01&endDate=2026-05-31
```

# 17.5 Export Endpoint
```http
GET /exports/itineraries?format=csv&startDate=2026-05-01&endDate=2026-05-31
```

---

# 18. Audit APIs

# 18.1 List Audit Logs
```http
GET /audit-logs?page=1&pageSize=50&entityType=ITINERARY&entityId=uuid
```

# 18.2 Export Audit Logs
```http
GET /audit-logs/export?startDate=2026-05-01&endDate=2026-05-31&format=csv
```

---

# 19. Import APIs

# 19.1 Upload Import File
```http
POST /imports
```

### multipart form-data
- file
- importType

# 19.2 Validate Import
```http
POST /imports/:id/validate
```

# 19.3 Get Import Validation Result
```http
GET /imports/:id
```

# 19.4 Commit Import
```http
POST /imports/:id/commit
```

---

# 20. Bot Operational APIs

These APIs are especially useful for the Telegram bot layer.

# 20.1 Get Role-aware Bot Menu
```http
GET /bot/menu?chatId=123456789
```

# 20.2 Driver Accept Assignment
```http
POST /bot/transport-tasks/:id/accept
```

```json
{
  "chatId": "123456789"
}
```

# 20.3 Driver Decline Assignment
```http
POST /bot/transport-tasks/:id/decline
```

# 20.4 Driver Mark On the Way
```http
POST /bot/transport-tasks/:id/on-the-way
```

# 20.5 Driver Mark Picked Up
```http
POST /bot/transport-tasks/:id/picked-up
```

# 20.6 Driver Mark Dropped Off
```http
POST /bot/transport-tasks/:id/dropped-off
```

# 20.7 Passenger My Trips (bot friendly)
```http
GET /bot/passengers/me/trips
```

# 20.8 Admin / Coordinator Ask Bot
```http
POST /bot/ask
```

### Request
```json
{
  "chatId": "123456789",
  "query": "Who is arriving tomorrow in LA?"
}
```

### Response
```json
{
  "data": {
    "answer": "Tomorrow’s LA arrivals: ...",
    "items": []
  }
}
```

---

# 21. Visibility Rules by Role

## Admin
Can view:
- everything

## Coordinator
Can view:
- scoped operational data only

## Passenger
Can view:
- own itineraries
- own transport
- own accommodation
- co-passengers on same itinerary

Cannot view:
- booking confirmation
- cost

## Driver
Can view:
- tasks assigned to them
- operational passenger/task details needed to perform duty

---

# 22. Webhook / Worker Notes

The system will likely need:
- Telegram update webhook endpoint
- worker jobs for reminders
- retry jobs for failed notification sends
- task regeneration/recalculation after approved segment changes

Example internal endpoint:
```http
POST /internal/workers/send-due-reminders
```

Protect all internal endpoints with service auth.

---

# 23. Recommended First API Slice

To unlock rapid progress, implement first:
1. auth verification middleware
2. users / roles
3. airports / mandirs / mappings
4. passengers
5. itineraries
6. segments
7. transport tasks
8. drivers
9. bot linking
10. bot driver actions

Then add:
11. approvals
12. public submissions
13. duplicates
14. reports
15. imports
16. AI query

---

# 24. Contract Summary

This API contract is sufficient to unlock:
- frontend dashboard work
- Telegram bot implementation
- driver action flows
- approval flows
- reports
- import workflows
- audit logs
