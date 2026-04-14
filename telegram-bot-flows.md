# telegram-bot-flows.md

# West Region Santos Flight Management System
## Telegram Bot Flows + Commands

This document defines the operational Telegram bot behavior for all roles:
- Admin
- Coordinator
- Passenger
- Driver

The bot is the primary operational messaging surface and must remain tightly aligned with backend source-of-truth logic.

---

# 1. Bot Principles

## 1.1 One bot for all roles
There is a single Telegram bot.
Role-specific behavior is determined after identity linking.

## 1.2 chat_id is identity
The bot must rely on:
- `telegram chat_id` for identity

The bot must not rely on:
- Telegram username

## 1.3 Backend-first logic
The bot should not contain private business rules that differ from backend behavior.
All major state transitions should call backend endpoints.

## 1.4 Rich operational messages
Notifications must include enough detail that drivers and coordinators can act without confusion.

---

# 2. Account Linking Flow

## 2.1 Entry point
User sends:

```text
/start
```

## 2.2 Bot response
```text
Welcome to West Region Santos Flight Management.

Please enter the email address or phone number associated with your account.

You may type it in any normal format.
```

## 2.3 User input handling
Accept:
- email
- phone number
- phone with spaces
- phone with punctuation
- phone with country code if normalization supports it

## 2.4 Backend matching order
1. exact email match
2. normalized phone match

## 2.5 Success response
```text
Your Telegram account has been linked successfully.

Role detected: Coordinator

Use the menu below to continue.
```

## 2.6 Failure response
```text
No matching account was found.

Please contact an admin to make sure your account exists and your email or phone number is entered correctly.
```

## 2.7 Relinking behavior
If a different `chat_id` is later linked:
- overwrite the old `chat_id`
- write audit log
- optionally notify admin if desired

---

# 3. Main Menus by Role

# 3.1 Admin Menu

Suggested buttons:
- Today’s Arrivals
- Pending Approvals
- Unassigned Transport
- Reports
- Ask Bot
- Open Dashboard

# 3.2 Coordinator Menu

Suggested buttons:
- Today’s Flights
- Unassigned Tasks
- Assigned Tasks
- Ask Bot
- Open Dashboard

# 3.3 Passenger Menu

Suggested buttons:
- My Upcoming Trips
- My Past Trips
- My Driver Info
- My Accommodation
- Help

# 3.4 Driver Menu

Suggested buttons:
- My Assignments
- Active Tasks
- Share Location
- Help

---

# 4. Driver Assignment Flows

# 4.1 New Assignment Message

```text
New Pickup Assignment

Passenger(s): Swami A, Swami B
Passenger Count: 2

Flight: UA123
Airline: United
Route: ORD → LAX
Arrival Time: 5:30 PM

Airport: LAX
Mandir: LA Mandir
Room: Room 12
Notes: Carry luggage for two passengers

Actions:
[Accept] [Decline]
```

## 4.1.1 Buttons
- Accept
- Decline

## 4.1.2 On Accept
Bot response:
```text
Assignment accepted.

You can update status below.
```

Buttons:
- On the Way
- Picked Up
- Dropped Off
- Share Location

## 4.1.3 On Decline
Bot response:
```text
You declined this assignment.

The coordinator has been notified.
```

System actions:
- log audit
- notify coordinator
- task remains unassigned or partially assigned depending on driver count rules

---

# 4.2 On the Way Flow

User taps:
- On the Way

Bot response:
```text
Status updated: On the Way

Coordinator and passenger have been notified.
```

System actions:
- set task status `EN_ROUTE` if appropriate
- log status history
- send notifications

---

# 4.3 Picked Up Flow

User taps:
- Picked Up

Bot response:
```text
Status updated: Picked Up

Coordinator and passenger have been notified.
```

System actions:
- set task status `PICKED_UP`
- log status history

---

# 4.4 Dropped Off Flow

User taps:
- Dropped Off

Bot response:
```text
Status updated: Dropped Off

Coordinator and passenger have been notified.
```

System actions:
- set task status `DROPPED_OFF`
- log status history
- optionally mark completed if workflow dictates

---

# 4.5 Share Location Flow

Driver taps:
- Share Location

Bot response:
```text
Please share your live location using Telegram’s location feature.
```

System behavior:
- store or forward location payload if implemented
- notify coordinator that location was shared

---

# 5. Assignment Change / Cancellation Flows

# 5.1 Assignment changed

```text
Update: Assignment Changed

Passenger(s): Swami A
Flight: UA123
Route: ORD → LAX
Updated Arrival Time: 6:10 PM

Airport: LAX
Mandir: LA Mandir
Notes: Flight time changed
```

Recipients:
- assigned drivers
- coordinator
- passenger
- relevant admin if configured

# 5.2 Assignment cancelled

```text
Update: Assignment Cancelled

Passenger(s): Swami A
Flight: UA123
Route: ORD → LAX

Reason: Itinerary cancelled
```

System actions:
- cancel task
- notify all relevant parties
- write audit log

---

# 6. Reminder Flows

# 6.1 24-hour reminder

```text
Reminder: Pickup in 24 Hours

Passenger(s): Swami A, Swami B
Flight: UA123
Route: ORD → LAX
Arrival Time: 5:30 PM

Airport: LAX
Mandir: LA Mandir
Room: Room 12
```

Recipients:
- driver
- coordinator
- admin
- passenger

# 6.2 2-hour reminder

```text
Reminder: Pickup in 2 Hours

Passenger(s): Swami A, Swami B
Flight: UA123
Route: ORD → LAX
Arrival Time: 5:30 PM

Airport: LAX
Mandir: LA Mandir
Notes: Meet at arrivals
```

---

# 7. Passenger Flows

# 7.1 My Upcoming Trips

Passenger taps:
- My Upcoming Trips

Bot should return a concise list:
```text
Your Upcoming Trips

1. ORD → LAX
   Flight: UA123
   Arrival: May 12, 5:30 PM
   Driver: Harsh Patel
   Mandir: LA Mandir

2. LAX → SFO
   Flight: UA456
   Departure: May 15, 3:00 PM
   Driver: Pending
   Mandir: SF Mandir
```

Buttons:
- View Trip 1
- View Trip 2

## 7.1.1 Detailed trip view
```text
Trip Details

Passengers:
- Swami A
- Swami B

Segments:
1. ORD → LAX | UA123 | Arrives 5:30 PM
2. LAX → SFO | UA456 | Departs 3:00 PM

Accommodation:
- LA Mandir | Room 12
- SF Mandir | Room 7

Transport:
- Pickup at LAX | Driver: Harsh Patel | Phone: xxx
- Drop-off at LAX | Driver: Pending
```

---

# 8. Coordinator Flows

# 8.1 Unassigned Tasks

Coordinator taps:
- Unassigned Tasks

Bot response:
```text
Unassigned Tasks

1. Pickup | LAX | UA123 | 2 passengers | Today 5:30 PM
2. Drop-off | SFO | UA890 | 1 passenger | Tomorrow 8:00 AM
```

Buttons:
- Open Dashboard
- Refresh

---

# 8.2 Assigned Tasks

Coordinator taps:
- Assigned Tasks

Bot response should list the most relevant current tasks with driver names and statuses.

---

# 8.3 Coordinator Alerts

Examples:
- new submission in scope
- unassigned task
- driver declined
- assignment changed
- itinerary cancelled
- flight data pending approval if coordinator initiated change

Example:
```text
Driver Declined Assignment

Task: Pickup
Airport: LAX
Flight: UA123
Passengers: 2
Arrival Time: 5:30 PM

Please assign another driver.
```

---

# 9. Admin Flows

# 9.1 Pending Approvals

Admin taps:
- Pending Approvals

Bot response:
```text
Pending Approvals

1. Flight segment update
   Coordinator: John
   Itinerary: 2 passengers
   Change: Arrival time 5:30 PM → 6:10 PM

2. New itinerary
   Coordinator: Amit
   Itinerary: 1 passenger
   Change: New ORD → LAX trip
```

Buttons:
- Review 1
- Review 2
- Open Dashboard

## 9.1.1 Review detail
```text
Approval Review

Entity: Flight Segment
Coordinator: John

Original:
Arrival Time: 5:30 PM

Proposed:
Arrival Time: 6:10 PM
Notes: Flight updated by coordinator

Actions:
[Approve] [Reject]
```

### On Approve
```text
Change approved successfully.
```

### On Reject
```text
Change rejected successfully.
```

---

# 10. Ask Bot / Read-only AI Flows

Admins and coordinators can ask free-form operational questions.

# 10.1 Entry points
- Ask Bot button
- direct natural language message after choosing Ask Bot mode

# 10.2 Example queries
- Who is arriving tomorrow in LA?
- Which pickups are unassigned?
- Show cost for last month
- Who is staying in SF mandir this week?

# 10.3 Rules
- read-only only
- no mutation
- coordinator scope must be enforced
- responses should summarize clearly
- sensitive data should follow role permissions

# 10.4 Example answer
```text
Tomorrow’s LA Arrivals

1. Swami A, Swami B
   Flight: UA123
   Route: ORD → LAX
   Arrival: 5:30 PM
   Pickup Driver: Harsh Patel

2. Swami C
   Flight: AA210
   Route: PHX → LAX
   Arrival: 7:15 PM
   Pickup Driver: Unassigned
```

---

# 11. Suggested Commands

Even if buttons are primary, support a small command set.

```text
/start
/help
/menu
/ask
/mytrips
/assignments
/approvals
/dashboard
```

---

# 12. Suggested Button Architecture

## Persistent navigation ideas
- Menu
- Back
- Refresh
- Open Dashboard

## Contextual action buttons
- Accept
- Decline
- On the Way
- Picked Up
- Dropped Off
- Approve
- Reject
- View Details

---

# 13. Failure Handling

# 13.1 Notification send failure
If message send fails:
- retry up to 3 times
- log error
- if still failing, notify coordinator or admin as appropriate

# 13.2 Unknown user after /start
Return clear instruction to contact admin.

# 13.3 Driver without chat_id
Do not queue Telegram delivery.
Notify coordinator that manual forwarding is required.

---

# 14. Bot State Management Recommendations

Use conversational states for:
- account linking
- Ask Bot mode
- approval review drill-down
- optional driver action confirmations

Keep state machine simple and backend-backed where possible.

---

# 15. Deep Link / Mini App Integration

Messages for coordinators and admins should often include:
- Open Dashboard button
- deep link to specific itinerary or task if Telegram mini app supports it

Examples:
- review pending approval in mini app
- open transport task details
- open itinerary details

---

# 16. Bot Implementation Summary

The Telegram bot must support:
- account linking from Telegram
- role-aware menus
- rich driver assignment flows
- passenger trip visibility
- coordinator operational alerts
- admin approvals
- read-only AI questions
- notification retries and escalation paths

This is enough to begin backend bot orchestration and UI planning.
