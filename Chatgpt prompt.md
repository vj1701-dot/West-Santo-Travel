Help me create a detailed PRD for my web app do not start coding. Create agents and skill as per needs. Ask questions before finalizing PRD. Ask as many questions u can. 

- I want to create a West Region Santos Flight Management system: 
Purpose of this app will be to track who u flying and who is picking them up and dropping them off. Where are they going to stay at that mandir. 

- First of all I want to clarify users and their access. Admins will have all access.They will also have ability to add price and confirmation number for each itinerary. That will only be visible to them. They should be able to export and create report or generate custom reports.   Then there will be passengers who will only able to see their own flights. Then there will be center/city specific transport coordinator, who will only see in bound flight to their assigned center/airports. Then there will be transport sevak who will be pickup and drop-off guy. He wont have access to the portal but he will be linked through telegram to get all necessary updates and notification. 
- Login - Use OAuth for login. Something free and opensource. easy to setup. Admin should be able to all users and give them access. Then users can go to telegram and subscribe to bot using the email they used for OAuth. Most of the admin and passenger will use 'xy1234@sampark.email' email address. 
- There will be dashboard for Admin, passenger, and transport coordinator. Transport sevak wont have telegram access. 
- Transport coordinator will be the one assigning transport sevak.   

Let's start with this. Ask me as many question u need to for front end, backend, AI integration



Understood. Before drafting the PRD, the system needs to be clearly defined across data model, workflows, permissions, integrations, and edge cases. Below is a structured set of questions grouped by area. Answer as many as possible—this will directly shape a high-quality PRD, agents, and skills.

⸻

1. Core Scope & Workflow

1.1 Flight Lifecycle
	•	What is the source of flight data?   -- Manual entry
	•	Manual entry by admin? -- Manual Entry as well as a link where guest santo can enter their details and submit. Open link. 
	•	Upload (PDF/image of itinerary)? -- No
	•	Email parsing? -- No
	•	Can a single booking include multiple santos? -- Yes. Sometimes we buy extra seat. so passenger can have EXST or something like that infront of their name.
	•	Can a santo have multi-leg journeys (layovers)? -- Yes
	•	Do we track:
	•	Only final arrival airport? All segments
	•	Or all segments? All segments   

1.2 End-to-End Flow

Confirm this flow or adjust:
	1.	Admin creates/imports flight - Guest can fill out their info as well
	2.	Passengers (santos) linked - Some times santos fly with haribhakto. they might not have account on our system. sometimes santos might not be on our system. Will get all west coast sanots on system but other santo wont be in system. 
	3.	Destination mandir assigned - both arrival and departure mandir. If arrival and departure is not in west coast then whichever one is. 
	4.	Transport coordinator sees inbound  - Inbound/outbound. whatever is flying in/out of their assigned airport/city
	5.	Coordinator assigns sevak  - Cordniator can assign sevaks only for his allowed airport/City
	6.	Sevak gets Telegram notification - Yes with all the details. plus he gets a reminders. 
	7.	Pickup/drop completed

	•	Should there be a status system? (e.g., Scheduled → Assigned → Picked Up → Completed) - Yes 

⸻

2. User Roles & Permissions

2.1 Admin
	•	Can admins:
	•	Edit everything including past records? - Yes
	•	Override assignments? - Yes
	•	Should there be super-admin vs admin? - No

2.2 Passenger (Santo)
	•	Can they:
	•	See only upcoming trips or full history? - Yes
	•	See who is picking them up + contact info? - Yes
	•	Confirm receipt (e.g., “I arrived”)? - Yes  but not necessary 

2.3 Transport Coordinator
	•	Assigned by:
	•	Airport? - Yes  
	•	City? - Yes
	•	Mandir? - Yes   
	•	Can they:
	•	Reassign sevaks? - Yes
	•	Edit flight details or only assign transport? - Only assign transport and flight detail, but admin will have to approve through telegram bot

2.4 Transport Sevak (Telegram-only)
	•	Should they:
	•	Accept/decline assignment? - Yes
	•	Share live location? - Yes
	•	Mark pickup complete? - Yes

⸻

3. Data Model (Critical)

3.1 Passenger (Santo)
	•	Fields: 
	•	First Name / Last Name
	•	Legal Name (for ticket match)
	•	Email
	•	Phone
	•	Telegram ID
	•	Anything else? (e.g., seniority, preferences?)

3.2 Flight / Itinerary

What fields are required:
	•	Airline
	•	Flight number
	•	Departure airport
	•	Arrival airport
	•	Departure time
	•	Arrival time
	•	Terminal / Gate? - No   
	•	Baggage info? - No
	•	Notes? 

Admin-only:
	•	Price
	•	Confirmation number

3.3 Mandir / Stay
	•	Do we store:
	•	Mandir name
	•	Address - Not needed. 
	•	Contact person? - Not needed. 
	•	Can a santo:
	•	Stay at multiple mandirs in one trip? - Yes
    Add which room they are staying in. 

3.4 Transport Assignment
	•	Fields:
	•	Pickup location (airport)
	•	Drop location (mandir)
	•	Assigned sevak
	•	Vehicle type? - Not needed
	•	Notes? - Yes

⸻

4. Telegram Bot Behavior

4.1 Core Actions

What should sevak be able to do:
	•	View assignment
	•	Accept / decline
	•	Mark:
	•	“On the way”
	•	“Picked up”
	•	“Dropped off”

4.2 Notifications

What triggers alerts:
	•	New assignment  - Yes   
	•	Flight delay
	•	24-hour reminder - Yes  
	•	2-hour reminder - Yes 
	•	Landing detected?

4.3 Passenger Notifications

Should santos also get Telegram alerts:
	•	Flight reminders? - Yes
	•	Pickup details? - Yes 

⸻

5. Flight Monitoring
	•	Do you want:
	•	Automatic flight tracking (delays, gate changes)? - No  
	•	Or manual updates only? - Manual updates only
	•	If automatic:
	•	Are you okay using:
	•	Paid APIs (FlightAware, AviationStack)?
	•	Or want free-only?

⸻

6. Reports & Analytics (Admin)

What reports do you need:
	•	Upcoming arrivals by date
	•	Pickup assignments
	•	Missed pickups?
	•	Cost reports    - Mostly this 
	•	Per mandir activity
	•	Per sevak activity
    Ability to export all data

Export formats:
	•	CSV
	•	Excel - Yes
	•	PDF?

Custom filters:
	•	Date range
	•	Airport
	•	Mandir
	•	Santo

⸻

7. UI / Dashboard Design

7.1 Admin Dashboard

What widgets:
	•	Today’s arrivals
	•	Pending assignments
	•	Active pickups
	•	Alerts

7.2 Transport Coordinator Dashboard
	•	Filter by:
	•	Airport? - No   
	•	Date? - Yes
	•	Should show:
	•	Unassigned flights
	•	Assigned pickups

7.3 Passenger Dashboard
	•	Minimal:
	•	Upcoming flights
	•	Pickup details
	•	Or more detailed?
All dashboard have to be mobile friendly. Will use them as telegram mini app in telegram bot 
⸻

8. Authentication & Identity

You mentioned OAuth:
	•	Preferred provider:
	•	Auth0
	•	Keycloak
	•	Firebase Authentication
    - WHich ever is easy to setup and open source or free. 

	•	Do you want:
	•	Strict domain restriction (only sampark.email)? No. 
	•	How will Telegram linking work:
	•	OTP via bot? - When they join bot will ask for email address. they just have to use the same address. 
	•	Email verification? - No 

    if a Sevak is not on Telegram, passenger/santos still should get his info. 

    All messages goes to Transport cordinator so he can forward to appropripate people. sometime sevak might not be enrolled. 

⸻

9. AI / Automation Opportunities
- Lets skip this. 

I wanted AI for cordinator and Admin to ask anything to bot and it collects data from database and use it to reply. so it acts as chat bot. 

You previously hinted at AI usage. Confirm:

9.1 Flight Intake
	•	Upload image/PDF → auto extract:
	•	Flight number
	•	Names
	•	Should we use AI OCR?

9.2 Name Matching
	•	Match:
	•	Ticket name → existing santo

9.3 Smart Assignment
	•	Suggest:
	•	Best sevak based on:
	•	Location
	•	availability
	•	past assignments

9.4 Alerts Intelligence
	•	Detect:
	•	Tight layovers
	•	Delays impacting pickup

⸻

10. System Architecture Preferences
	•	Hosting:
	•	Cloud Run?
	•	Local server? - Yes. On windows server using docker. 
	•	Database:
	•	PostgreSQL? - Yes or whatever is prefered. 
	•	Do you want:
	•	Docker-first setup? - Yes. 

⸻

11. Scale & Usage
	•	Number of:
	•	Flights per week? - 5
	•	Santos? - 100
	•	Coordinators? - 15
	•	Peak usage expectations? - 

⸻

12. Edge Cases (Important)

How should system handle:
	•	Flight delays - Lets keep this manual. 
	•	Missed flights - Admin will handle. 
	•	Multiple santos arriving same flight - If santos are on same flight but different booking then treat them as coming together. 
	•	No sevak available - No action  
	•	Last-minute reassignment - Cordinator will handle. 
	•	Santo cancels trip - Admin will handle. 

⸻

13. Security & Privacy
	•	Should:
	•	Phone numbers be visible to all roles? - yes. on telegram and web
	•	Admin-only fields: Price and booking confirmation
	•	Strictly hidden in API too? - not really 

⸻

14. Future Features (Optional but helpful now)
	•	Room allocation at mandir? yes, admin or cordinator will add that for each sant for each mandir
	•	Return flights tracking? - No
	•	Multi-region expansion? - No
	•	Integration with calendar (Google Calendar)? - No

⸻

1. Flight + Segment Modeling (VERY IMPORTANT)

You said multi-leg journeys + all segments tracked.

Clarify structure:
	•	Should each itinerary be:
	•	One parent trip → multiple segments (recommended) - Yes 
	•	OR treat each segment as independent flight?

👉 Recommended:

Trip (Santo)
 ├── Segment 1: SFO → DEN
 ├── Segment 2: DEN → JFK

Question:
	•	Do you want transport assigned per segment or only:
	•	First arrival segment?
	•	Last arrival segment?
	•	Both arrival + departure? - Both arrival and departure

⸻

2. Transport Scope Logic

You mentioned:

“If arrival and departure is not west coast then whichever one is”

Need exact rule:
	•	Example:
	•	NYC → Chicago → LA

👉 Which segment triggers transport?
	•	Only final arrival (LA)? - Yes
	•	Or any segment inside assigned coordinator region?

Define rule clearly:
	•	Transport is required when:
	•	Segment arrival airport matches coordinator region - yes
	•	Segment departure airport matches region - yes
	•	Both 

⸻

3. Mandir Stay Logic (Complex Case)

You said:
	•	Santo can stay at multiple mandirs - Let say there is sant from non different region and he came to west coast and he has a ticket from LA to SF then i want to add their room for LA and SF. But let say its a local sant already staying in LA and he has to come to SF then i only need to enter SF room. This field is not mandatory but its good to have. 
	•	Need room assignment

Clarify:
	•	Is mandir linked to:
	•	Entire trip? - Entire trip. West coast santos are living in west coast mandirs. 
	•	OR per segment? 

👉 Example:
	•	Arrives LA → stays Mandir A
	•	Then travels → stays Mandir B

Question:
	•	Should we model: Yes. 

Trip
 ├── Stay 1 (Mandir A, Room X, Dates)
 ├── Stay 2 (Mandir B, Room Y, Dates)


⸻

4. Guest Santo Handling (No Account)

You said:

Some santos / haribhakto won’t be in system

Clarify behavior:
	•	Should we:
	•	Create temporary passenger records (recommended)    - Create record but not required to login. Adding them to telegram and linking them would be tricky. Maybe Admin telegram bot manager can link them? 
	•	Or allow “free-text name”? 

👉 Strong recommendation:
	•	Always create record (even without login) - Yes

Question:
	•	Is email required for guest santos? - No 

⸻

5. EXST (Extra Seat Handling)

You mentioned:

EXST prefix

Clarify:
	•	Should system:
	•	Ignore EXST completely?
	•	Or track it as:
	•	Extra seat (non-person)
	•	Linked to same santo? - We will use that to track price and cost of trip. So maybe add same sant name and check exst box.

👉 Recommended:
	•	Store as flag on passenger record

⸻

6. Approval Workflow (Important)

You said:

Coordinator edits → admin approves via Telegram

Clarify flow:
	•	When coordinator edits:
	•	Does change:
	•	Go into “pending approval” state? - goes into pending approval. But there will be 3 or 4 admins so how can we ease this so not everyone gets bothered. Lets link airport and mandirs to admin too. They can see and change all airports and mandirs but they are in charge of their own mandir.
	•	Or immediately applied then reversible?

👉 Suggested:

Edit → Pending → Admin approves → Applied

Question:
	•	Should admin approve:
	•	Only flight edits? - Flights only
	•	OR transport assignment too? 

⸻

7. Telegram Bot — Coordinator Role

You said:

All messages go to coordinator sometimes

Clarify:
	•	Should coordinator bot:
	•	Receive ALL updates for their region? - All
	•	Act as fallback if sevak not on Telegram?
	•	Should coordinator:
	•	Manually forward messages? - Manually when needed. 
	•	Or system auto-forward?

⸻

8. Sevak Without Telegram

You said:

Sevak may not be on Telegram

Clarify fallback:
	•	How do they get info?
	•	Coordinator calls/texts manually? - Cordinator will manually forward 
	•	SMS fallback needed? - No
	•	Email fallback? - No    

👉 Important design decision.

⸻

9. Status Model (Define Exactly)

You confirmed status system, but need exact states:

Proposed:

CREATED
CONFIRMED
ASSIGNED
EN_ROUTE
PICKED_UP
DROPPED_OFF
COMPLETED
CANCELLED

Question:
	•	Any additional states?

⸻

10. Reporting — Cost Model

You said:

Cost reports are important

Clarify:
	•	Cost is tied to:
	•	Flight?
	•	Per passenger? yes 
	•	Per booking? yes 
	•	Should system support:
	•	Splitting cost across santos? do both. total and individual. 
	•	Or just store total?

⸻

11. Open Guest Form (Public Link)

You said:

Guest can submit via open link

Clarify:
	•	Should form allow:
	•	Multiple santos in one submission? - Yes
	•	Upload itinerary details manually? - Yes
	•	Should submission:
	•	Auto-create trip?
	•	OR go to admin approval queue? - Yes

⸻

12. AI Chatbot Scope (Important)

You said:

Admin/Coordinator can ask bot questions

Clarify expected queries:

Examples:
	•	“Who is arriving tomorrow in LA?”
	•	“Which pickups are pending?”
	•	“Show cost for last month”

Question:
	•	Should bot:
	•	Only read data? - Only read
	•	OR also perform actions (assign, update)?

⸻

13. Telegram Mini App

You said:

Dashboards will be Telegram mini app

Clarify:
	•	Do you want:
	•	Full web app embedded in Telegram? - Full
	•	OR lightweight UI with limited features? 

⸻

14. Timezone Handling

Critical for flights:
	•	Should system:
	•	Store all times in UTC? in Pacific standard time. 
	•	Display based on:
	•	Airport timezone? airport time zone 
	•	User timezone?

👉 Recommendation: Airport timezone

⸻

15. Duplicate Detection
	•	If same santo submits multiple times:
	•	Should system:
	•	Detect duplicates? detect and notify admin
	•	Or allow duplicates?

⸻

🟡 Optional (But Helpful)
	•	Do you want audit logs (who changed what)? Yes. Detailed. 
	•	Should we allow bulk upload via CSV? Yes 
	•	Should system support recurring coordinators per airport? yes

⸻

Final Round of Questions

1. Admin Ownership / Approval Routing

You said admins can see everything, but each admin is “in charge of their own mandir,” and approvals for flight edits should not bother all admins.

Please clarify:
	•	Should each admin be assigned by:
	•	Mandir
	•	Airport
	•	Both    - Both  
	•	For a flight edit approval, who should receive it?
	•	Admin assigned to arrival mandir
	•	Admin assigned to departure mandir
	•	Admin assigned to arrival airport
	•	Any one eligible admin can approve - yes
	•	If a trip touches multiple mandirs, who is the primary approver? - Any admin 

⸻

2. What Exactly Can a Coordinator Edit?

You said:
	•	Coordinator can assign transport - Yes
	•	Coordinator can edit flight detail, but admin must approve - Yes 

Please define exactly which fields coordinators may propose changes for: All
	•	Airline
	•	Flight number
	•	Departure airport
	•	Arrival airport
	•	Departure time
	•	Arrival time
	•	Notes
	•	Passenger names
	•	Mandir stay / room
	•	Transport assignments

Also:
	•	Can a coordinator create a new trip from scratch, or only edit existing ones? Can Create

⸻

3. Booking vs Passenger Cost Structure

You said cost matters both per passenger and per booking, and EXST affects cost.

Clarify:
	•	Do you want:
	•	One booking record with total price
	•	Then optional per-passenger allocation - Yes
	•	If 2 santos are on same booking:
	•	Should admin manually split cost? 
	•	Or system divide evenly by default? - Divide evenly
	•	If EXST exists:
	•	Should EXST cost be shown separately?
	•	Or included under the linked santo’s total? - included in linked santos

⸻

4. Passenger Types

There seem to be different kinds of travelers:
	•	West Coast santo with account
	•	Other-region santo without account
	•	Haribhakto traveling with santo
	•	Extra seat (EXST)

Should we explicitly classify traveler type as: - Yes but if a guest sant is given account then he still will be guest sant.
	•	WEST_SANTO
	•	GUEST_SANTO
	•	HARIBHAKTO
	•	EXTRA_SEAT

Or do you want something simpler?

⸻

5. Passenger Dashboard Scope

You said passengers can see:
	•	Upcoming trips or full history
	•	Pickup details
	•	Contact info

Clarify:
	•	Should passenger also see:
	•	Stay/room info? - Yes 
	•	Other santos on same itinerary? - Yes 
	•	Booking confirmation?  no
	•	Cost?  no

Also:
	•	Can passenger edit anything from dashboard?
	•	No edits - No Edits 
	•	Request change
	•	Edit only own phone / Telegram

⸻

6. Public Submission Form

You said:
	•	Open link
	•	Multiple santos in one submission
	•	Goes to admin approval queue

Clarify the form fields:

For each submission, should it ask for:
	•	Submitter name
	•	Submitter phone - No
	•	Submitter email - No    
	•	Is submitter one of the travelers? - Mostly
	•	Passenger list - Yes 
	•	Flight segments - Yes 
	•	Mandir stay info - Auto assign based on airport. 
	•	Notes - Yes

Also:
	•	Should submitter choose:
	•	Arrival mandir - No this will be based on Airport
	•	Departure mandir   - No this will be based on airport
	•	Room info   - Admin or cordinator will assign. 
	•	Or should admin fill those later?

⸻

7. Coordinator Assignment Model

You said coordinators can be assigned by airport/city/mandir and can have recurring assignment.

Clarify:
	•	Is coordinator assignment:
	•	One coordinator per airport - One
	•	Multiple coordinators per airport
	•	If multiple:
	•	Do all see same trips?
	•	Or assign one as primary and others backup?
	•	Can one coordinator manage:
	•	Multiple airports - Yes 
	•	Multiple mandirs   - Yes 
	•	Multiple cities - Yes

⸻

8. Sevak Assignment Model

Need to define sevak records clearly.

Should sevak have:
	•	Name
	•	Phone
	•	Telegram username / ID
	•	Assigned airports - Multiple Airports
	•	Assigned city - No
	•	Vehicle capacity? you said no vehicle type, but capacity may matter - No 
	•	Notes
	•	Active/inactive status - No

Also:
	•	Can one trip have multiple sevaks? Yes. 
	•	Example: one for pickup, another for dropoff - Sometimes there will be more thn one sevak for dropoff and pickup. based on number of santos coming. 
	•	Or is it always one sevak per transport task?

⸻

9. Pickup vs Drop-off as Separate Tasks

This is a very important modeling choice.

Recommended:

Treat these as separate transport tasks:
	•	Arrival pickup task
	•	Departure drop-off task

That way:
	•	Different sevaks can be assigned
	•	Different statuses can be tracked
	•	Different reminders can be sent

Confirm:

Do you want:
	•	Separate task per transport event — recommended- Sperate. 
	•	Or one combined assignment object - No

⸻

10. Reminder Timing

You already want:
	•	New assignment
	•	24-hour reminder
	•	2-hour reminder

Clarify recipients for each:

For pickup task:
	•	Sevak? - Yes    
	•	Coordinator?- Yes 
	•	Passenger?- Yes 
  Admin for that airport - - Yes 

For flight reminder:
	•	Passenger? - Yes 
	•	Coordinator?- Yes 
    Admin for that airport - - Yes 

For pending/unassigned transport:
	•	Only coordinator? Yes
	•	Admin too? Yes

⸻

11. Telegram Bot Flows by Role

Need to know whether you want one bot or multiple role experiences inside one bot.

Confirm:
	•	One Telegram bot for everyone? One For All
	•	Or separate bot for admin/coordinator/passenger/sevak? - Nop

Also:
	•	Should the bot show different menus based on linked role?
	•	Should admin/coordinator be able to open mini app directly from bot menu? Yes

⸻

12. Login + Account Provisioning

You said OAuth, easy/free/open-source, and users later link Telegram using the same email.

Clarify:
	•	How are new users created?
	•	Admin manually creates them first- Manually create them in frontend. 
	•	Anyone can sign in, but no access until admin assigns role
	•	If someone logs in with a matching email not yet assigned:
	•	Deny access? - Yes
	•	Allow limited self-registration?
	•	Should admin be able to invite users by email?

⸻

13. Mini App UX Priorities

Since the full web app will run inside Telegram mini app, I need your preference on UI emphasis.

Rank what matters most:
	•	Fast entry / low clicks -2
	•	Dense table views
	•	Mobile-first cards  - 1
	•	Search-4
	•	Filters-3
	•	Calendar-style view
	•	Kanban/status board
	•	Report pages

Also:
	•	Is desktop web portal also important? - Yes
	•	Or Telegram mobile is primary? Telegram is primary

⸻

14. Search & Filters

For admin/coordinator dashboards, should there be global search for:
	•	Santo name - Yes
	•	Legal name
	•	Flight number
	•	Booking confirmation
	•	Airport - Yes
	•	Mandir  - Yes
	•	Phone number

Which of these are must-have?

⸻

15. Audit Logs

You said detailed audit logs.

Confirm what to log:
	•	Who created trip
	•	Who edited which field
	•	Old value → new value
	•	Approval actions
	•	Transport assignment changes
	•	Telegram actions:
	•	accepted
	•	declined
	•	on the way
	•	picked up
	•	dropped off

Do you also want:
	•	IP/device logging?
	•	CSV export of audit logs?
Yes to ALL
⸻

16. CSV Import

You want bulk upload via CSV.

Please clarify expected import types:
	•	Passenger master list
	•	Trips / itineraries
	•	Flight segments
	•	Mandir stays
	•	Sevak list
	•	Coordinator assignments

Do you want CSV import to:
	•	Validate and preview before save - Validate
	•	Or import directly

Recommended: preview + error report. Yes 

⸻

17. Duplicate Detection Rules

You said detect duplicates and notify admin.

What counts as duplicate?

Possible rules:
	•	Same passenger + same flight number + same date
	•	Same booking confirmation + same traveler
	•	Same legal name + same departure/arrival + close times

Which should be used? -All

⸻

18. Room / Stay Details

You said room info is optional but useful.

Clarify stay fields:
	•	Mandir name
	•	Room number/name
	•	Check-in date
	•	Check-out date
	•	Notes

Anything else?
	•	Host/contact- No
	•	Floor/building - No
	•	Bed count   - No

⸻

19. Terminology / Naming

To keep the PRD clean, I need preferred labels.

What should the UI use for these:
	•	Passenger or Traveler or Santo   - Passenger
	•	Transport Sevak or Driver   - Driver
	•	Coordinator or Transport Coordinator - Coordinator
	•	Mandir Stay or Accommodation - Accomodation
	•	Trip or Itinerary - Itinerary

⸻

20. Read-only Chatbot Scope

You want admin/coordinator to ask questions to the bot from database.

Confirm preferred access point:
	•	Inside Telegram bot chat
	•	Inside web app chat panel - No
	•	Both - Just Telegram bot

And should chatbot answer:
	•	Only current operational questions
	•	Or also report-style questions and summaries - Both

⸻Good PRD — it's clearly thought through. Here's my analysis of what's solid and what's still missing or underspecified before you can build this confidently.

---

## ✅ What's Well Covered

The core data model (Itinerary → Segments → Transport Tasks), role system, Telegram flows, approval workflow, and architecture stack are all clearly defined. Good foundation.

---

## 🔴 Missing / Gaps That Will Block Development

### 1. **Authentication & User Management**
The PRD says "role detected via email linking" for the Telegram bot, but there's no auth system defined anywhere:
- How do web app users log in? (OAuth? Magic link? Username/password?)
- How is a Telegram user *linked* to a web account? (One-time code? Admin-assigned?)
- What happens when someone's Telegram ID changes or they switch accounts?
- Session management / JWT / token refresh strategy?

### 2. **Region Model is Undefined**
Region is mentioned repeatedly ("assigned region," "West Region") but never defined as an entity:
- Is a Region just a set of airports? A set of mandirs? Both?
- How does "this segment belongs to my region" get determined — by airport code?
- Can an airport belong to multiple regions? What if two coordinators cover overlapping airports?

### 3. **Airport ↔ Mandir Mapping**
Section 9 says "Mandir auto-mapped via airport" — but there's no mapping table defined:
- Is this a config table in the DB? A hardcoded list?
- What if an airport maps to multiple mandirs (e.g., LAX serves two)?
- Who manages/edits this mapping?

### 4. **Notification Delivery Details**
The notification table (Section 6.5) lists *what* to send but not *how*:
- Are Telegram notifications the only channel, or also email/SMS?
- What's the message template for each event type?
- What happens if a driver has no Telegram ID? Fallback?
- Who gets the "unassigned alert" if no coordinator is assigned to that airport?

### 5. **Cancellation & Edit Flows**
Status model has `CANCELLED` but no flow is described:
- Who can cancel an itinerary? Only admin?
- What happens to transport tasks when an itinerary is cancelled? Auto-cancelled or manual?
- If a flight segment is edited (time change), do transport tasks auto-update or need re-assignment?

### 6. **Cost Split Edge Cases**
Section 2.4 mentions EXST cost is included in the linked santo, and manual override is allowed — but:
- Can a booking span multiple itineraries (group booking)?
- What's the UI for manual override — per-passenger fixed amount, or percentage?
- What happens to cost if a passenger is removed after a booking is entered?

### 7. **Driver Availability / Capacity**
Drivers are assignable to tasks but:
- Is there any concept of driver availability or max capacity per day?
- Can a driver be assigned to overlapping pickup times? Any conflict detection?
- Who notifies a driver if their assignment is *removed* after they accepted?

---

## 🟡 Underspecified (Needs Decisions Before Build)

- **Public Submission Form** — Who receives it? Any admin with access to those airports, or a global admin queue? Can a submitter track their submission status?
- **Pagination & Data Volume** — No mention of how lists are paginated (especially important for dashboards and reports).
- **Time Zone Handling** — PRD says "PST stored, airport tz displayed" but doesn't address DST transitions or how international legs are handled.
- **Multi-leg transport logic** — If a passenger has a layover, does the system create a transport task for the layover city too, or only origin/final destination?
- **AI Agent access control** — Section 14 says "read-only" but doesn't define how the agent authenticates to the DB or API, or what data is off-limits (e.g., can it expose booking confirmation numbers?).
- **Error states for Telegram** — What if a message fails to send? Retry logic? Fallback alert to coordinator?
