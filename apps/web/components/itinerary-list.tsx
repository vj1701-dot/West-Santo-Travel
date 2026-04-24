"use client";

import Link from "next/link";

import { getAirlineBrand } from "@/lib/airlines";

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

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAirportSummary(airport: { code: string; name: string; city: string | null }) {
  return `${airport.code} - ${airport.name}${airport.city ? `, ${airport.city}` : ""}`;
}

function formatPassengerNames(passengerNames: string[]) {
  if (passengerNames.length === 0) return "No passengers assigned";
  return passengerNames.join(", ");
}

export function ItineraryList({ itineraries, role }: { itineraries: ItineraryRecord[]; role: string }) {
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
          <div className="boarding-pass-list">
            {itineraries.map((itinerary) => {
              const primarySegment = itinerary.flightSegments[0];
              const brand = getAirlineBrand(primarySegment?.airline ?? "");
              const passengerNames = itinerary.itineraryPassengers.map((entry) => `${entry.passenger.firstName} ${entry.passenger.lastName}`);
              const pickupTasks = itinerary.transportTasks.filter((task) => task.taskType === "PICKUP");
              const dropoffTasks = itinerary.transportTasks.filter((task) => task.taskType === "DROPOFF");
              const accommodationNotes = itinerary.accommodations.map((item) => item.notes).filter(Boolean);
              const routeLabel = itinerary.flightSegments
                .map((segment) => `${segment.departureAirport.code} to ${segment.arrivalAirport.code}`)
                .join(" / ");
              const googleSheetsReviewRequired = itinerary.externalSyncLinks.some(
                (link) => link.provider === "google-sheets" && link.syncStatus === "REVIEW_REQUIRED",
              );

              return (
                <article key={itinerary.id} className="boarding-pass">
                  <div className="boarding-pass__stub">
                    <div className="boarding-pass__brand">
                      <span>{brand.code}</span>
                      <strong>{brand.name}</strong>
                    </div>
                    <TicketField label="Flight" value={primarySegment?.flightNumber ?? "Pending"} />
                    <TicketField label="Departure" value={primarySegment ? formatDateTime(primarySegment.departureTimeLocal) : "Not scheduled"} />
                    <TicketField label="Destination" value={routeLabel || "Route pending"} />
                    <div className="boarding-pass__mini-barcode" aria-hidden="true" />
                  </div>

                  <div className="boarding-pass__main">
                    <div className="boarding-pass__stripe">
                      <span>West Santo Travel</span>
                      <div className="boarding-pass__top-actions">
                        <strong>Boarding Pass</strong>
                        <span className="pill">{itinerary.status}</span>
                        {role !== "PASSENGER" && googleSheetsReviewRequired ? <span className="pill pending">Sync review</span> : null}
                        {role !== "PASSENGER" ? (
                          <Link className="button-secondary" href={`/itineraries/${itinerary.id}/edit`}>
                            Edit
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <div className="boarding-pass__body">
                      <div className="boarding-pass__identity">
                        <TicketField label="Name" value={formatPassengerNames(passengerNames)} />
                        <div className="boarding-pass__route">
                          <span>{primarySegment?.departureAirport.code ?? "DEP"}</span>
                          <strong>to</strong>
                          <span>{primarySegment?.arrivalAirport.code ?? "ARR"}</span>
                        </div>
                        <div className="boarding-pass__segments">
                          {itinerary.flightSegments.map((segment) => (
                            <div key={segment.id} className="boarding-pass__segment">
                              <div>
                                <strong>{segment.departureAirport.code} to {segment.arrivalAirport.code}</strong>
                                <span>{formatAirportSummary(segment.departureAirport)} / {formatAirportSummary(segment.arrivalAirport)}</span>
                              </div>
                              <div>
                                <strong>{segment.flightNumber}</strong>
                                <span>{formatDateTime(segment.departureTimeLocal)} to {formatDateTime(segment.arrivalTimeLocal)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="boarding-pass__side">
                        <TicketField label="Flight" value={primarySegment?.flightNumber ?? "Pending"} />
                        <TicketField label="Status" value={itinerary.status} />
                        <TicketField label="Updated" value={formatDateTime(itinerary.updatedAt)} />
                        <div className="boarding-pass__barcode" aria-hidden="true" />
                      </div>
                    </div>

                    <div className="boarding-pass__extras">
                      <DetailRow label="Passengers" value={formatPassengerNames(passengerNames)} />
                      {pickupTasks.length > 0 ? (
                        <DetailRow
                          label="Pickup"
                          value={pickupTasks.map((task) => `${task.airport.code}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || task.status}`).join(" / ")}
                        />
                      ) : null}
                      {dropoffTasks.length > 0 ? (
                        <DetailRow
                          label="Dropoff"
                          value={dropoffTasks.map((task) => `${task.airport.code}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || task.status}`).join(" / ")}
                        />
                      ) : null}
                      {accommodationNotes.length > 0 ? <DetailRow label="Accommodation" value={accommodationNotes.join(" / ")} /> : null}
                      {itinerary.notes ? <DetailRow label="Trip Note" value={itinerary.notes} /> : null}
                      {itinerary.approvalRequests.length > 0 ? (
                        <DetailRow label="Approvals" value={itinerary.approvalRequests.map((approval) => approval.status).join(", ")} />
                      ) : null}
                    </div>
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

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div className="ticket-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailRow({ label, value, secondaryValue }: { label: string; value: string; secondaryValue?: string }) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div className="ticket-detail">
      <p className="eyebrow">{label}</p>
      <p>{value}</p>
      {secondaryValue ? <span>{secondaryValue}</span> : null}
    </div>
  );
}
