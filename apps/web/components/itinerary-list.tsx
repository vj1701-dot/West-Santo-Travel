"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plane } from "lucide-react";

import { getAirlineBrand } from "@/lib/airlines";

type ItineraryRecord = {
  id: string;
  status: string;
  notes: string | null;
  updatedAt: Date;
  isArchived: boolean;
  itineraryPassengers: Array<{
    passenger: {
      id: string;
      firstName: string;
      lastName: string;
      passengerType: string;
    };
  }>;
  flightSegments: Array<{
    id: string;
    airline: string;
    flightNumber: string;
    departureTimeLocal: Date;
    arrivalTimeLocal: Date;
    departureAirport: { code: string; name: string; city: string | null };
    arrivalAirport: { code: string; name: string; city: string | null };
  }>;
  transportTasks: Array<{
    id: string;
    taskType: string;
    status: string;
    airport: { code: string };
    mandir: { name: string } | null;
    drivers: Array<{ driver: { name: string } }>;
    notes: string | null;
  }>;
  accommodations: Array<{
    mandir: { name: string } | null;
    notes: string | null;
  }>;
  approvalRequests: Array<{
    id: string;
    status: string;
  }>;
  externalSyncLinks: Array<{
    id: string;
    provider: string;
    syncStatus: string;
  }>;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPassengerName(firstName: string, lastName: string) {
  return [lastName, firstName].filter(Boolean).join(" ").trim();
}

function formatAirportLabel(airport?: { code: string; city: string | null }) {
  return airport?.city?.trim() || airport?.code || "Airport";
}

function formatTransportSummary(
  tasks: ItineraryRecord["transportTasks"],
  taskType: "PICKUP" | "DROPOFF",
) {
  const matchingTasks = tasks.filter((task) => task.taskType === taskType);

  if (matchingTasks.length === 0) {
    return "Unassigned";
  }

  return matchingTasks
    .map((task) => `${task.airport.code}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || "Unassigned"}`)
    .join(" / ");
}

function routeSummary(segments: ItineraryRecord["flightSegments"]) {
  if (segments.length === 0) return "Route pending";
  return `${segments[0].departureAirport.code} \u2192 ${segments[segments.length - 1].arrivalAirport.code}`;
}

function formatFlightLabel(segment: ItineraryRecord["flightSegments"][number]) {
  const airlineCode = getAirlineBrand(segment.airline).code;
  const normalizedFlightNumber = segment.flightNumber.trim().toUpperCase();

  if (normalizedFlightNumber.startsWith(airlineCode)) {
    return normalizedFlightNumber;
  }

  return `${airlineCode}${normalizedFlightNumber.replace(/\s+/g, "")}`;
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

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sortByTripDateAscending(left: ItineraryRecord, right: ItineraryRecord) {
  const leftSegment = left.flightSegments[0];
  const rightSegment = right.flightSegments[0];
  const leftDate = tripDateForItinerary(left);
  const rightDate = tripDateForItinerary(right);

  if (!leftDate || !leftSegment) return 1;
  if (!rightDate || !rightSegment) return -1;

  if (leftDate.getTime() !== rightDate.getTime()) {
    return leftDate.getTime() - rightDate.getTime();
  }

  return leftSegment.departureTimeLocal.getTime() - rightSegment.departureTimeLocal.getTime();
}

function sortByTripDateDescending(left: ItineraryRecord, right: ItineraryRecord) {
  return sortByTripDateAscending(right, left);
}

export function ItineraryList({
  activeSource,
  archivedSource,
  focusedItineraryId,
}: {
  activeSource: ItineraryRecord[];
  archivedSource: ItineraryRecord[];
  focusedItineraryId?: string | null;
}) {
  const { currentTrips, oldTrips } = useMemo(() => {
    const today = startOfToday();

    const current = activeSource
      .filter((itinerary) => {
        const tripDate = tripDateForItinerary(itinerary);
        return Boolean(tripDate) && !itinerary.isArchived && tripDate! >= today;
      })
      .sort(sortByTripDateAscending);

    const oldMap = new Map<string, ItineraryRecord>();

    for (const itinerary of archivedSource) {
      const tripDate = tripDateForItinerary(itinerary);
      const isPastTrip = Boolean(tripDate) && tripDate! < today;

      if (itinerary.isArchived || isPastTrip) {
        oldMap.set(itinerary.id, itinerary);
      }
    }

    const old = Array.from(oldMap.values()).sort(sortByTripDateDescending);

    const promoteFocused = (items: ItineraryRecord[]) => {
      if (!focusedItineraryId) {
        return items;
      }

      return [...items].sort((left, right) => {
        if (left.id === focusedItineraryId) return -1;
        if (right.id === focusedItineraryId) return 1;
        return 0;
      });
    };

    return {
      currentTrips: promoteFocused(current),
      oldTrips: promoteFocused(old),
    };
  }, [activeSource, archivedSource, focusedItineraryId]);

  return (
    <section className="stack">
      <div className="panel stack">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Operations</p>
            <h2>{currentTrips.length} itinerary{currentTrips.length === 1 ? "" : "ies"}</h2>
          </div>
        </div>

        {currentTrips.length === 0 ? (
          <p className="notes">No current itineraries from today forward.</p>
        ) : (
          <div className="boarding-pass-grid">
            {currentTrips.map((itinerary) => (
              <ItineraryCard focused={itinerary.id === focusedItineraryId} itinerary={itinerary} key={itinerary.id} />
            ))}
          </div>
        )}
      </div>

      <section className="dashboard-card stack old-itineraries-section">
        <div className="row-card__title">
          <div>
            <p className="eyebrow">History</p>
            <h3>Old / Archived Trips</h3>
          </div>
          <span className="pill archived">{oldTrips.length}</span>
        </div>
        {oldTrips.length === 0 ? (
          <p className="notes">No archived or past-date trips to show.</p>
        ) : (
          <div className="boarding-pass-grid boarding-pass-grid--old">
            {oldTrips.map((itinerary) => (
              <ItineraryCard focused={itinerary.id === focusedItineraryId} itinerary={itinerary} key={itinerary.id} muted />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function ItineraryCard({
  itinerary,
  focused = false,
  muted = false,
}: {
  itinerary: ItineraryRecord;
  focused?: boolean;
  muted?: boolean;
}) {
  const primarySegment = itinerary.flightSegments[0];
  const finalSegment = itinerary.flightSegments[itinerary.flightSegments.length - 1] ?? primarySegment;
  const passengerNames = itinerary.itineraryPassengers.map((entry) =>
    formatPassengerName(entry.passenger.firstName, entry.passenger.lastName),
  );
  const googleSheetsReviewRequired = itinerary.externalSyncLinks.some(
    (link) => link.provider === "google-sheets" && link.syncStatus === "REVIEW_REQUIRED",
  );
  const airlineCode = primarySegment ? getAirlineBrand(primarySegment.airline).code : "FL";

  return (
    <article
      className={`boarding-pass-card${focused ? " boarding-pass-card--focused" : ""}${muted ? " boarding-pass-card--muted" : ""}`}
    >
      <div className="boarding-pass-card__route">
        <div>
          <p className="boarding-pass-card__eyebrow">{primarySegment ? formatFlightLabel(primarySegment) : "Flight pending"}</p>
          <h3>{routeSummary(itinerary.flightSegments)}</h3>
        </div>
        <div className="boarding-pass-card__actions">
          <span
            className={`pill ${itinerary.isArchived ? "archived" : itinerary.status === "CONFIRMED" ? "confirmed" : itinerary.status === "PENDING_APPROVAL" ? "pending" : ""}`}
          >
            {itinerary.isArchived ? "Archived" : itinerary.status}
          </span>
          {googleSheetsReviewRequired ? <span className="pill pending">Sync review</span> : null}
          {
            <Link className="button-secondary" href={`/itineraries/${itinerary.id}/edit`}>
              Edit
            </Link>
          }
        </div>
      </div>

      <div className="boarding-pass-card__meta">
        <div className="boarding-pass-card__code">{formatAirportLabel(primarySegment?.departureAirport)}</div>
        <div className="boarding-pass-card__flight">
          <Plane aria-hidden="true" size={16} strokeWidth={2} />
          <span>{airlineCode}</span>
          <strong>{primarySegment ? primarySegment.flightNumber : "Pending"}</strong>
        </div>
        <div className="boarding-pass-card__code boarding-pass-card__code--arrival">
          {formatAirportLabel(finalSegment?.arrivalAirport)}
        </div>
      </div>

      <div className="boarding-pass-card__divider" aria-hidden="true" />

      <div className="boarding-pass-card__timing">
        <div className="boarding-pass-card__timing-block">
          <span>Departure</span>
          <strong>{formatDateTime(primarySegment?.departureTimeLocal)}</strong>
        </div>
        <div className="boarding-pass-card__timing-block">
          <span>Arrival</span>
          <strong>{formatDateTime(finalSegment?.arrivalTimeLocal)}</strong>
        </div>
      </div>

      <div className="boarding-pass-card__details">
        <p>
          <strong>Passengers:</strong> {passengerNames.join("; ") || "No passengers assigned"}
        </p>
        <p>
          <strong>Pickup:</strong> {formatTransportSummary(itinerary.transportTasks, "PICKUP")}
        </p>
        <p>
          <strong>Drop-off:</strong> {formatTransportSummary(itinerary.transportTasks, "DROPOFF")}
        </p>
      </div>
    </article>
  );
}
