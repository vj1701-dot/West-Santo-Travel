"use client";

import Link from "next/link";
import { useMemo } from "react";

type ItineraryRecord = {
  id: string;
  status: string;
  notes: string | null;
  updatedAt: Date;
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

function formatPassengerNames(passengerNames: string[]) {
  if (passengerNames.length === 0) return "No passengers assigned";
  return passengerNames.join(", ");
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

function formatRoute(segments: ItineraryRecord["flightSegments"]) {
  if (segments.length === 0) return "Route pending";
  return `${segments[0].departureAirport.code} → ${segments[segments.length - 1].arrivalAirport.code}`;
}

function formatFlights(segments: ItineraryRecord["flightSegments"]) {
  if (segments.length === 0) return "Flight pending";
  return segments.map((segment) => `${segment.airline} · ${segment.flightNumber}`).join(" / ");
}

export function ItineraryList({
  itineraries,
  role,
  focusedItineraryId,
}: {
  itineraries: ItineraryRecord[];
  role: string;
  focusedItineraryId?: string | null;
}) {
  const orderedItineraries = useMemo(() => {
    if (!focusedItineraryId) {
      return itineraries;
    }

    return [...itineraries].sort((left, right) => {
      if (left.id === focusedItineraryId) return -1;
      if (right.id === focusedItineraryId) return 1;
      return 0;
    });
  }, [focusedItineraryId, itineraries]);

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">{role === "PASSENGER" ? "My Travel" : "Operations"}</p>
            <h2>{itineraries.length} itinerary{itineraries.length === 1 ? "" : "ies"}</h2>
          </div>
        </div>

        {itineraries.length === 0 ? (
          <p className="notes">No itineraries found.</p>
        ) : (
          <div className="itinerary-grid">
            {orderedItineraries.map((itinerary) => {
              const primarySegment = itinerary.flightSegments[0];
              const finalSegment = itinerary.flightSegments[itinerary.flightSegments.length - 1] ?? primarySegment;
              const passengerNames = itinerary.itineraryPassengers.map(
                (entry) => `${entry.passenger.firstName} ${entry.passenger.lastName}`,
              );
              const googleSheetsReviewRequired = itinerary.externalSyncLinks.some(
                (link) => link.provider === "google-sheets" && link.syncStatus === "REVIEW_REQUIRED",
              );

              return (
                <article
                  className={`itinerary-card${itinerary.id === focusedItineraryId ? " itinerary-card--focused" : ""}`}
                  key={itinerary.id}
                >
                  <div className="itinerary-card__header">
                    <div>
                      <h3>{formatRoute(itinerary.flightSegments)}</h3>
                      <p className="itinerary-card__subtitle">{formatFlights(itinerary.flightSegments)}</p>
                    </div>
                    <div className="itinerary-card__actions">
                      <span
                        className={`pill ${itinerary.status === "CONFIRMED" ? "confirmed" : itinerary.status === "PENDING_APPROVAL" ? "pending" : ""}`}
                      >
                        {itinerary.status}
                      </span>
                      {role !== "PASSENGER" && googleSheetsReviewRequired ? <span className="pill pending">Sync review</span> : null}
                      {role !== "PASSENGER" ? (
                        <Link className="button-secondary" href={`/itineraries/${itinerary.id}/edit`}>
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="itinerary-card__timing">
                    <div className="itinerary-card__timing-item">
                      <span>Departure</span>
                      <strong>{formatDateTime(primarySegment?.departureTimeLocal)}</strong>
                    </div>
                    <div className="itinerary-card__timing-item">
                      <span>Arrival</span>
                      <strong>{formatDateTime(finalSegment?.arrivalTimeLocal)}</strong>
                    </div>
                  </div>

                  <div className="itinerary-card__details">
                    <p>
                      <strong>Passengers:</strong> {formatPassengerNames(passengerNames)}
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
            })}
          </div>
        )}
      </div>
    </section>
  );
}
