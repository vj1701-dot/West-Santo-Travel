import Link from "next/link";
import { listAirports, listItineraries, listPassengers } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { OverviewFilters } from "@/components/overview-filters";
import { getAirlineBrand } from "@/lib/airlines";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const INVALID_SCOPE_FILTER = "00000000-0000-0000-0000-000000000000";

type OverviewSearchParams = {
  previewRole?: string | string[];
  passengerId?: string | string[];
  airportId?: string | string[];
};

type ItineraryRecord = Awaited<ReturnType<typeof listItineraries>>[number];

type UpcomingTripRecord = {
  itinerary: ItineraryRecord;
  primarySegment: ItineraryRecord["flightSegments"][number];
  tripDate: Date;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatPassengerName(user: { firstName: string; lastName: string }) {
  return [user.lastName, user.firstName].filter(Boolean).join(" ").trim();
}

function getParamArray(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.from(new Set((Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean)));
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getScopedAirportIds(selectedAirportIds: string[], coordinatorAirportIds: string[], isCoordinator: boolean) {
  if (!isCoordinator) {
    return selectedAirportIds.length > 0 ? selectedAirportIds : undefined;
  }

  if (coordinatorAirportIds.length === 0) {
    return [INVALID_SCOPE_FILTER];
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

function formatFlightLabel(segment: ItineraryRecord["flightSegments"][number]) {
  const airlineCode = getAirlineBrand(segment.airline).code;
  const normalizedFlightNumber = segment.flightNumber.trim().toUpperCase();

  if (normalizedFlightNumber.startsWith(airlineCode)) {
    return normalizedFlightNumber;
  }

  return `${airlineCode}${normalizedFlightNumber.replace(/\s+/g, "")}`;
}

function flightHeadline(segment: ItineraryRecord["flightSegments"][number]) {
  return `${formatFlightLabel(segment)} \u00B7 ${routeSummary(segment)}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function tripDateForItinerary(itinerary: ItineraryRecord) {
  const primarySegment = itinerary.flightSegments[0];

  if (!primarySegment) {
    return null;
  }

  return new Date(
    primarySegment.departureTimeLocal.getFullYear(),
    primarySegment.departureTimeLocal.getMonth(),
    primarySegment.departureTimeLocal.getDate(),
  );
}

function buildUpcomingTrips(itineraries: ItineraryRecord[]) {
  const today = startOfToday();

  return itineraries
    .map((itinerary) => {
      const primarySegment = itinerary.flightSegments[0];
      const tripDate = tripDateForItinerary(itinerary);

      if (!primarySegment || !tripDate) {
        return null;
      }

      return {
        itinerary,
        primarySegment,
        tripDate,
      };
    })
    .filter((trip): trip is UpcomingTripRecord => Boolean(trip))
    .filter((trip) => trip.tripDate >= today)
    .sort((left, right) => {
      if (left.tripDate.getTime() !== right.tripDate.getTime()) {
        return left.tripDate.getTime() - right.tripDate.getTime();
      }

      return left.primarySegment.departureTimeLocal.getTime() - right.primarySegment.departureTimeLocal.getTime();
    });
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
    currentUser.role === "ADMIN" && ["ADMIN", "COORDINATOR"].includes(previewRole ?? "")
      ? (previewRole as "ADMIN" | "COORDINATOR")
      : currentUser.role;

  const selectedPassengerIds = getParamArray(resolvedSearchParams.passengerId);
  const selectedAirportIds = getParamArray(resolvedSearchParams.airportId);
  const coordinatorAirportIds = effectiveRole === "COORDINATOR" ? currentUser.coordinatorAirports.map((assignment) => assignment.airportId) : [];

  const [passengers, airports] = await Promise.all([listPassengers(), listAirports()]);
  const visibleAirports = airports.filter(
    (airport) => effectiveRole !== "COORDINATOR" || coordinatorAirportIds.includes(airport.id),
  );
  const scopedAirportIds = getScopedAirportIds(selectedAirportIds, coordinatorAirportIds, effectiveRole === "COORDINATOR");

  const itineraries = await listItineraries({
    airportIds: scopedAirportIds,
    passengerIds: selectedPassengerIds.length > 0 ? selectedPassengerIds : undefined,
  });

  const upcomingTrips = buildUpcomingTrips(itineraries);

  return (
    <AppShell currentUser={currentUser} effectiveRole={effectiveRole}>
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
            label: formatPassengerName(passenger),
            detail: passenger.passengerType.replace(/_/g, " "),
          }))}
          previewRole={previewRole}
          selectedAirportIds={selectedAirportIds.filter((airportId) => visibleAirports.some((airport) => airport.id === airportId))}
          selectedPassengerIds={selectedPassengerIds.filter((passengerId) => passengers.some((passenger) => passenger.id === passengerId))}
        />
        <UpcomingTripsSection title="Upcoming Travels" trips={upcomingTrips} />
      </>
    </AppShell>
  );
}

function UpcomingTripsSection({
  title,
  trips,
}: {
  title: string;
  trips: UpcomingTripRecord[];
}) {
  return (
    <section className="dashboard-card stack">
      <div className="row-card__title">
        <div>
          <p className="eyebrow">Travel</p>
          <h3>{title}</h3>
        </div>
      </div>
      {trips.length === 0 ? (
        <p className="notes">No upcoming trips match the current filters.</p>
      ) : (
        <div className="overview-trip-grid">
          {trips.map(({ itinerary, primarySegment }) => (
            <Link className="trip-card overview-trip-link" href={deepLinkHref(itinerary.id)} key={itinerary.id}>
              <div className="row-card__title">
                <div>
                  <h3>{flightHeadline(primarySegment)}</h3>
                </div>
                <span
                  className={`pill ${itinerary.status === "CONFIRMED" ? "confirmed" : itinerary.status === "PENDING_APPROVAL" ? "pending" : ""}`}
                >
                  {itinerary.status}
                </span>
              </div>
              <div className="overview-trip-details">
                <p>
                  <strong>Departure:</strong> {formatDateTime(primarySegment.departureTimeLocal)}
                </p>
                <p>
                  <strong>Arrival:</strong> {formatDateTime(primarySegment.arrivalTimeLocal)}
                </p>
                <p>
                  <strong>Passengers:</strong> {itinerary.itineraryPassengers.map((item) => formatPassengerName(item.passenger)).join("; ")}
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
