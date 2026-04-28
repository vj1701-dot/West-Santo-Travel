import Link from "next/link";
import { listAirports, listItineraries, listPassengerItineraries, listPassengers } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { OverviewFilters } from "@/components/overview-filters";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const INVALID_SCOPE_FILTER = "__none__";

type OverviewSearchParams = {
  previewRole?: string | string[];
  passengerId?: string | string[];
  airportId?: string | string[];
};

type ItineraryRecord = Awaited<ReturnType<typeof listItineraries>>[number];

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

function getParamArray(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.from(new Set((Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean)));
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getScopedAirportIds(selectedAirportIds: string[], coordinatorAirportIds: string[]) {
  if (coordinatorAirportIds.length === 0) {
    return selectedAirportIds.length > 0 ? selectedAirportIds : undefined;
  }

  if (selectedAirportIds.length === 0) {
    return coordinatorAirportIds;
  }

  const allowedAirportIds = coordinatorAirportIds.filter((airportId) => selectedAirportIds.includes(airportId));
  return allowedAirportIds.length > 0 ? allowedAirportIds : [INVALID_SCOPE_FILTER];
}

function formatDriverAssignments(itinerary: ItineraryRecord, taskType: "PICKUP" | "DROPOFF") {
  const names = itinerary.transportTasks
    .filter((task) => task.taskType === taskType)
    .flatMap((task) => task.drivers.map((entry) => entry.driver.name))
    .filter(Boolean);

  return names.length > 0 ? Array.from(new Set(names)).join(", ") : "Unassigned";
}

function routeSummary(segment: ItineraryRecord["flightSegments"][number]) {
  return `${segment.departureAirport.code} \u2192 ${segment.arrivalAirport.code}`;
}

function flightHeadline(segment: ItineraryRecord["flightSegments"][number]) {
  return `${segment.airline} ${segment.flightNumber} \u00B7 ${routeSummary(segment)}`;
}

function deepLinkHref(itineraryId: string) {
  return `/itineraries?itineraryId=${encodeURIComponent(itineraryId)}`;
}

function buildClearHref(previewRole?: string) {
  return previewRole ? `/?previewRole=${encodeURIComponent(previewRole)}` : "/";
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<OverviewSearchParams>;
}) {
  const currentUser = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const previewRole = getParamValue(resolvedSearchParams.previewRole);
  const effectiveRole =
    currentUser.role === "ADMIN" && ["ADMIN", "COORDINATOR", "PASSENGER"].includes(previewRole ?? "")
      ? (previewRole as "ADMIN" | "COORDINATOR" | "PASSENGER")
      : currentUser.role;

  const selectedPassengerIds = getParamArray(resolvedSearchParams.passengerId);
  const selectedAirportIds = getParamArray(resolvedSearchParams.airportId);
  const coordinatorAirportIds =
    effectiveRole === "COORDINATOR" ? currentUser.coordinatorAirports.map((assignment) => assignment.airportId) : [];

  const [passengers, airports] = await Promise.all([listPassengers(), listAirports()]);
  const visibleAirports = airports.filter(
    (airport) => effectiveRole !== "COORDINATOR" || coordinatorAirportIds.includes(airport.id),
  );
  const scopedAirportIds = getScopedAirportIds(selectedAirportIds, coordinatorAirportIds);

  const itineraries = await (
    effectiveRole === "PASSENGER"
      ? listPassengerItineraries(currentUser.id, {
          airportIds: scopedAirportIds,
        })
      : listItineraries({
          airportIds: scopedAirportIds,
          passengerIds: selectedPassengerIds.length > 0 ? selectedPassengerIds : undefined,
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
    .filter((item): item is { itinerary: ItineraryRecord; nextSegment: ItineraryRecord["flightSegments"][number] } => Boolean(item.nextSegment))
    .sort((a, b) => a.nextSegment.departureTimeUtc.getTime() - b.nextSegment.departureTimeUtc.getTime());

  return (
    <AppShell currentUser={currentUser} effectiveRole={effectiveRole}>
      {effectiveRole !== "PASSENGER" ? (
        <>
          <OverviewFilters
            airports={visibleAirports.map((airport) => ({
              id: airport.id,
              code: airport.code,
              name: airport.name,
              city: airport.city,
              country: airport.country,
            }))}
            clearHref={buildClearHref(previewRole)}
            passengers={passengers.map((passenger) => ({
              id: passenger.id,
              label: `${passenger.firstName} ${passenger.lastName}`,
              detail: passenger.passengerType.replace(/_/g, " "),
            }))}
            previewRole={previewRole}
            selectedAirportIds={selectedAirportIds.filter((airportId) => visibleAirports.some((airport) => airport.id === airportId))}
            selectedPassengerIds={selectedPassengerIds.filter((passengerId) => passengers.some((passenger) => passenger.id === passengerId))}
          />
          <UpcomingTripsSection
            title="Upcoming Trips"
            trips={upcomingTrips.slice(0, effectiveRole === "COORDINATOR" ? 6 : 4)}
          />
        </>
      ) : (
        <PassengerOverview trips={upcomingTrips} />
      )}
    </AppShell>
  );
}

function UpcomingTripsSection({
  title,
  trips,
}: {
  title: string;
  trips: Array<{
    itinerary: ItineraryRecord;
    nextSegment: ItineraryRecord["flightSegments"][number];
  }>;
}) {
  return (
    <section className="dashboard-card stack">
      <div className="row-card__title">
        <div>
          <p className="eyebrow">Travel</p>
          <h3>{title}</h3>
        </div>
        <Link className="button-secondary" href="/itineraries">
          View all
        </Link>
      </div>
      {trips.length === 0 ? (
        <p className="notes">No upcoming trips match the current filters.</p>
      ) : (
        <div className="overview-trip-grid">
          {trips.map(({ itinerary, nextSegment }) => (
            <Link className="trip-card overview-trip-link" href={deepLinkHref(itinerary.id)} key={itinerary.id}>
              <div className="row-card__title">
                <div>
                  <h3>{flightHeadline(nextSegment)}</h3>
                </div>
                <span
                  className={`pill ${itinerary.status === "CONFIRMED" ? "confirmed" : itinerary.status === "PENDING_APPROVAL" ? "pending" : ""}`}
                >
                  {itinerary.status}
                </span>
              </div>
              <div className="overview-trip-details">
                <p>
                  <strong>Departure:</strong> {formatDateTime(nextSegment.departureTimeLocal)}
                </p>
                <p>
                  <strong>Arrival:</strong> {formatDateTime(nextSegment.arrivalTimeLocal)}
                </p>
                <p>
                  <strong>Passengers:</strong> {itinerary.itineraryPassengers.map((item) => fullName(item.passenger)).join(", ")}
                </p>
                <p>
                  <strong>Pickup:</strong> {formatDriverAssignments(itinerary, "PICKUP")}
                </p>
                <p>
                  <strong>Drop-off:</strong> {formatDriverAssignments(itinerary, "DROPOFF")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function PassengerOverview({
  trips,
}: {
  trips: Array<{
    itinerary: ItineraryRecord;
    nextSegment: ItineraryRecord["flightSegments"][number];
  }>;
}) {
  const featured = trips[0];

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

  return (
    <section className="dashboard-card stack passenger-trip-card">
      <div className="row-card__title">
        <div>
          <p className="eyebrow">Your next trip</p>
          <h3>{flightHeadline(featured.nextSegment)}</h3>
        </div>
        <Link className="button-secondary" href={deepLinkHref(featured.itinerary.id)}>
          Open trip
        </Link>
      </div>
      <div className="overview-trip-details">
        <p>
          <strong>Airline:</strong> {featured.nextSegment.airline}
        </p>
        <p>
          <strong>Departure:</strong> {formatDateTime(featured.nextSegment.departureTimeLocal)}
        </p>
        <p>
          <strong>Arrival:</strong> {formatDateTime(featured.nextSegment.arrivalTimeLocal)}
        </p>
        <p>
          <strong>Passengers:</strong> {featured.itinerary.itineraryPassengers.map((item) => fullName(item.passenger)).join(", ")}
        </p>
        <p>
          <strong>Pickup:</strong> {formatDriverAssignments(featured.itinerary, "PICKUP")}
        </p>
        <p>
          <strong>Drop-off:</strong> {formatDriverAssignments(featured.itinerary, "DROPOFF")}
        </p>
      </div>
    </section>
  );
}
