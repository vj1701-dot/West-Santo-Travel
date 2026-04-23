import Link from "next/link";
import { listAirports, listItineraries, listPassengerItineraries, listPassengers } from "@west-santo/data";
import { CheckCircle2, Clock3, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FlightCalendarTimeline } from "@/components/flight-calendar-timeline";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ previewRole?: string; passengerId?: string; airportId?: string }>;
}) {
  const currentUser = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const effectiveRole =
    currentUser.role === "ADMIN" && ["ADMIN", "COORDINATOR", "PASSENGER"].includes(resolvedSearchParams.previewRole ?? "")
      ? (resolvedSearchParams.previewRole as "ADMIN" | "COORDINATOR" | "PASSENGER")
      : currentUser.role;

  const [passengers, airports] = await Promise.all([listPassengers(), listAirports()]);
  const selectedPassengerId = resolvedSearchParams.passengerId ?? "";
  const selectedAirportId = resolvedSearchParams.airportId ?? "";
  const coordinatorAirportIds =
    effectiveRole === "COORDINATOR" ? currentUser.coordinatorAirports.map((assignment) => assignment.airportId) : [];
  const scopedAirportIds =
    selectedAirportId && coordinatorAirportIds.length > 0
      ? coordinatorAirportIds.filter((airportId) => airportId === selectedAirportId)
      : coordinatorAirportIds.length > 0
        ? coordinatorAirportIds
        : selectedAirportId
          ? [selectedAirportId]
          : undefined;

  const itineraries = await (
    effectiveRole === "PASSENGER"
      ? listPassengerItineraries(currentUser.id, {
          airportIds: selectedAirportId ? [selectedAirportId] : undefined,
        })
      : listItineraries({
          airportIds: scopedAirportIds,
          passengerId: selectedPassengerId || undefined,
        })
  );

  const upcomingTrips = itineraries
    .map((itinerary) => {
      const nextSegment =
        itinerary.flightSegments
          .filter((segment) => segment.departureTimeUtc >= new Date())
          .sort((a, b) => a.departureTimeUtc.getTime() - b.departureTimeUtc.getTime())[0] ?? itinerary.flightSegments[0];

      return {
        itinerary,
        nextSegment,
      };
    })
    .filter((item) => item.nextSegment)
    .sort((a, b) => a.nextSegment!.departureTimeUtc.getTime() - b.nextSegment!.departureTimeUtc.getTime());

  const todayTripCount = upcomingTrips.filter(({ nextSegment }) => {
    if (!nextSegment) return false;
    const now = new Date();
    return nextSegment.departureTimeUtc.toDateString() === now.toDateString();
  }).length;
  const unassignedTransportCount = itineraries.flatMap((item) => item.transportTasks).filter((task) => task.drivers.length === 0).length;
  const pendingApprovalsCount = itineraries.flatMap((item) => item.approvalRequests).filter((item) => item.status === "PENDING").length;
  const calendarFlights = itineraries.flatMap((itinerary) =>
    itinerary.flightSegments.map((segment) => ({
      id: segment.id,
      airline: segment.airline,
      flightNumber: segment.flightNumber,
      route: `${segment.departureAirport.code} to ${segment.arrivalAirport.code}`,
      status: itinerary.status,
      departureAirportCode: segment.departureAirport.code,
      departureAirportName: segment.departureAirport.name,
      arrivalAirportCode: segment.arrivalAirport.code,
      departureTimeUtc: segment.departureTimeUtc.toISOString(),
      arrivalTimeUtc: segment.arrivalTimeUtc.toISOString(),
    })),
  );

  return (
    <AppShell currentUser={currentUser} effectiveRole={effectiveRole}>
      <section className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">{effectiveRole === "PASSENGER" ? "Passenger View" : "Dashboard"}</p>
          <h1 className="dashboard-title">
            {effectiveRole === "PASSENGER" ? "Hello," : "Good morning,"} <em>{currentUser.firstName}</em>
          </h1>
          <p className="page-header__description">
            {effectiveRole === "PASSENGER"
              ? "Your upcoming travel details, trip status, and support contacts in one place."
              : `${todayTripCount} trips active today across ${Math.max(1, airports.length)} hubs. Keep the current routes and names while using the redesigned dashboard shell.`}
          </p>
        </div>
        {effectiveRole !== "PASSENGER" ? (
          <div className="page-header__actions">
            <a className="button-secondary" href="/api/exports/trips">
              Export
            </a>
            <Link className="link-button-primary" href="/add-flight">
              New itinerary
            </Link>
          </div>
        ) : null}
      </section>

      {effectiveRole !== "PASSENGER" ? (
        <form className="dashboard-card" method="GET">
          {resolvedSearchParams.previewRole ? <input name="previewRole" type="hidden" value={resolvedSearchParams.previewRole} /> : null}
          <div className="row-card__title" style={{ alignItems: "end" }}>
            <div>
              <p className="eyebrow">Filters</p>
              <h3 style={{ marginTop: "4px" }}>Operational scope</h3>
            </div>
            <div className="actions-row">
              <button type="submit">Apply filters</button>
              <a
                className="button-secondary"
                href={resolvedSearchParams.previewRole ? `/?previewRole=${resolvedSearchParams.previewRole}` : "/"}
              >
                Clear
              </a>
            </div>
          </div>
          <div className="detail-grid" style={{ marginTop: "16px" }}>
            <label className="field">
              <span>Passenger filter</span>
              <select defaultValue={selectedPassengerId} name="passengerId">
                <option value="">All passengers</option>
                {passengers.map((passenger) => (
                  <option key={passenger.id} value={passenger.id}>
                    {passenger.firstName} {passenger.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Airport filter</span>
              <select defaultValue={selectedAirportId} name="airportId">
                <option value="">All airports</option>
                {airports
                  .filter((airport) => effectiveRole !== "COORDINATOR" || coordinatorAirportIds.includes(airport.id))
                  .map((airport) => (
                    <option key={airport.id} value={airport.id}>
                      {airport.code} - {airport.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </form>
      ) : null}

      {effectiveRole === "PASSENGER" ? (
        <PassengerOverview upcomingTrips={upcomingTrips.slice(0, 4)} />
      ) : (
        <OperationsOverview
          effectiveRole={effectiveRole}
          pendingApprovalsCount={pendingApprovalsCount}
          calendarFlights={calendarFlights}
          nowIso={new Date().toISOString()}
          upcomingTrips={upcomingTrips.slice(0, effectiveRole === "COORDINATOR" ? 6 : 4)}
          unassignedTransportCount={unassignedTransportCount}
        />
      )}
    </AppShell>
  );
}

function OperationsOverview({
  effectiveRole,
  unassignedTransportCount,
  pendingApprovalsCount,
  calendarFlights,
  nowIso,
  upcomingTrips,
}: {
  effectiveRole: "ADMIN" | "COORDINATOR";
  unassignedTransportCount: number;
  pendingApprovalsCount: number;
  calendarFlights: Array<{
    id: string;
    airline: string;
    flightNumber: string;
    route: string;
    status: string;
    departureAirportCode: string;
    departureAirportName: string;
    arrivalAirportCode: string;
    departureTimeUtc: string;
    arrivalTimeUtc: string;
  }>;
  nowIso: string;
  upcomingTrips: Array<{
    itinerary: Awaited<ReturnType<typeof listItineraries>>[number];
    nextSegment: Awaited<ReturnType<typeof listItineraries>>[number]["flightSegments"][number];
  }>;
}) {
  return (
    <div className="dashboard-grid">
      <div className="dashboard-span-12">
        <FlightCalendarTimeline flights={calendarFlights} nowIso={nowIso} />
      </div>

      <div className="dashboard-span-8 dashboard-legacy-timeline">
        <section className="dashboard-card stack">
          <div className="row-card__title">
            <div>
              <p className="eyebrow">Overview</p>
              <h3>Today&apos;s flights timeline</h3>
            </div>
            <span className="pill confirmed">
              <span className="bullet" />
              Live
            </span>
          </div>
          <div className="stack--tight" style={{ display: "grid", gap: "12px" }}>
            {upcomingTrips.slice(0, 6).map(({ itinerary, nextSegment }) => (
              <div key={itinerary.id} className="compact-card" style={{ background: "var(--surface-2)" }}>
                <div className="row-card__title">
                  <div>
                    <h3>
                      {nextSegment.departureAirport.code} to {nextSegment.arrivalAirport.code}
                    </h3>
                    <p className="muted-inline">
                      {nextSegment.flightNumber} • {formatDateTime(nextSegment.departureTimeLocal)} • {formatDateTime(nextSegment.arrivalTimeLocal)}
                    </p>
                  </div>
                  <span className={`pill ${itinerary.status === "CONFIRMED" ? "confirmed" : itinerary.status === "PENDING_APPROVAL" ? "pending" : ""}`}>
                    {itinerary.status}
                  </span>
                </div>
                <div className="row-meta">
                  <span>{nextSegment.departureAirport.name}</span>
                  <span>{nextSegment.arrivalAirport.name}</span>
                  <span>{itinerary.itineraryPassengers.length} passengers</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-span-4">
        <section className="dashboard-card stack">
          <div className="row-card__title">
            <div>
              <p className="eyebrow">Operations</p>
              <h3>Unassigned transport</h3>
            </div>
            <span className="pill pending">{unassignedTransportCount}</span>
          </div>
          {upcomingTrips.slice(0, 4).map(({ itinerary, nextSegment }) => {
            const task = itinerary.transportTasks.find((item) => item.drivers.length === 0);
            return (
              <div key={`${itinerary.id}-transport`} className="compact-card">
                <div className="row-card__title">
                  <div>
                    <strong style={{ color: "var(--ink-900)" }}>
                      {task ? `${task.taskType} needed` : "Trip monitored"} • {nextSegment.flightNumber}
                    </strong>
                    <p className="muted-inline">
                      {nextSegment.departureAirport.code} • {itinerary.itineraryPassengers.length} travelers
                    </p>
                  </div>
                  <Link className="button-secondary" href="/transport-tasks">
                    Assign
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <div className="dashboard-span-8">
        <section className="dashboard-card stack">
          <div className="row-card__title">
            <div>
              <p className="eyebrow">Travel</p>
              <h3>Upcoming Trips</h3>
            </div>
            <Link className="button-secondary" href="/itineraries">
              View all
            </Link>
          </div>
          <div className="detail-grid">
            {upcomingTrips.map(({ itinerary, nextSegment }) => (
              <article key={itinerary.id} className="trip-card">
                <div className="row-card__title">
                  <div>
                    <div className="eyebrow">{nextSegment.airline}</div>
                    <h3>
                      {nextSegment.departureAirport.code} to {nextSegment.arrivalAirport.code}
                    </h3>
                  </div>
                  <span className={`pill ${itinerary.status === "CONFIRMED" ? "confirmed" : itinerary.status === "PENDING_APPROVAL" ? "pending" : ""}`}>
                    {itinerary.status}
                  </span>
                </div>
                <div className="detail-list">
                  <li>
                    <strong>{nextSegment.flightNumber}</strong>
                    <span>{formatDateTime(nextSegment.departureTimeLocal)}</span>
                  </li>
                  <li>
                    <strong>Passengers</strong>
                    <span>{itinerary.itineraryPassengers.map((item) => fullName(item.passenger)).join(", ")}</span>
                  </li>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-span-4">
        <section className="stack">
          <div className="dashboard-card">
            <div className="row-card__title">
              <div>
                <p className="eyebrow">Approvals</p>
                <h3>{effectiveRole === "ADMIN" ? "Admin queue" : "Current queue"}</h3>
              </div>
              <span className="pill approval">{pendingApprovalsCount}</span>
            </div>
            <p className="notes" style={{ marginTop: "12px" }}>
              Pending approval requests remain available under the current route and naming structure.
            </p>
          </div>
          <div className="dashboard-card">
            <div className="row-card__title">
              <div>
                <p className="eyebrow">Alerts</p>
                <h3>Operational notes</h3>
              </div>
              <Clock3 size={16} color="var(--warning)" />
            </div>
            <div className="stack--tight" style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              <div className="compact-card">Keep transport assignments current for same-day itineraries.</div>
              <div className="compact-card">Review reminders for flights departing in the next 24 hours.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PassengerOverview({
  upcomingTrips,
}: {
  upcomingTrips: Array<{
    itinerary: Awaited<ReturnType<typeof listPassengerItineraries>>[number];
    nextSegment: Awaited<ReturnType<typeof listPassengerItineraries>>[number]["flightSegments"][number];
  }>;
}) {
  const featured = upcomingTrips[0];

  if (!featured) {
    return (
      <section className="dashboard-card">
        <h3>No upcoming travel</h3>
        <p className="notes" style={{ marginTop: "8px" }}>
          Your travel will appear here once a trip is assigned.
        </p>
      </section>
    );
  }

  const pickup = featured.itinerary.transportTasks.find((task) => task.taskType === "PICKUP");
  const dropoff = featured.itinerary.transportTasks.find((task) => task.taskType === "DROPOFF");
  const daysUntilDeparture = Math.max(
    0,
    Math.ceil((featured.nextSegment.departureTimeUtc.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="dashboard-grid">
      <div className="dashboard-span-12">
        <section
          className="dashboard-card"
          style={{
            background: "linear-gradient(135deg, #eef2ff 0%, #ffffff 62%)",
            borderColor: "var(--accent-200)",
          }}
        >
          <div className="detail-grid" style={{ gridTemplateColumns: "1.65fr .75fr" }}>
            <div className="stack">
              <p className="eyebrow">Your next trip</p>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "48px", lineHeight: 1, color: "var(--ink-900)" }}>
                {featured.nextSegment.departureAirport.code} to {featured.nextSegment.arrivalAirport.code}
              </div>
              <div className="row-meta">
                <span>{featured.nextSegment.flightNumber}</span>
                <span>{featured.nextSegment.airline}</span>
                <span>{formatDateTime(featured.nextSegment.departureTimeLocal)}</span>
              </div>
              <div className="detail-grid">
                <div className="info-tile">
                  <span>Pickup driver</span>
                  <strong>{pickup?.drivers.map((entry) => entry.driver.name).join(", ") || "Pending"}</strong>
                </div>
                <div className="info-tile">
                  <span>Dropoff driver</span>
                  <strong>{dropoff?.drivers.map((entry) => entry.driver.name).join(", ") || "Pending"}</strong>
                </div>
              </div>
            </div>
            <div className="info-tile" style={{ alignContent: "center", textAlign: "center", padding: "24px" }}>
              <span>Days to departure</span>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "56px", lineHeight: 1 }}>{daysUntilDeparture}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="dashboard-span-7">
        <section className="dashboard-card stack">
          <div className="row-card__title">
            <div>
              <p className="eyebrow">Checklist</p>
              <h3>Trip readiness</h3>
            </div>
            <CheckCircle2 size={18} color="var(--success)" />
          </div>
          {[
            "Flight scheduled",
            "Passenger assigned",
            "Transport reviewed",
            "Contact details available",
          ].map((item) => (
            <div key={item} className="compact-card" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CheckCircle2 size={18} color="var(--success)" />
              <span>{item}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="dashboard-span-5">
        <section className="dashboard-card stack">
          <div className="row-card__title">
            <div>
              <p className="eyebrow">Contacts</p>
              <h3>Support details</h3>
            </div>
            <Users size={18} color="var(--accent)" />
          </div>
          <div className="info-tile">
            <span>Pickup driver</span>
            <strong>{pickup?.drivers.map((entry) => entry.driver.name).join(", ") || "Pending"}</strong>
          </div>
          <div className="info-tile">
            <span>Dropoff driver</span>
            <strong>{dropoff?.drivers.map((entry) => entry.driver.name).join(", ") || "Pending"}</strong>
          </div>
          <div className="info-tile">
            <span>Trip notes</span>
            <strong>{featured.itinerary.notes || "No notes yet"}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}
