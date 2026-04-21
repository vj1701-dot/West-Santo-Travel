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
          <div className="grid gap-4">
            {itineraries.map((itinerary) => {
              const primarySegment = itinerary.flightSegments[0];
              const brand = getAirlineBrand(primarySegment?.airline ?? "");
              const passengerNames = itinerary.itineraryPassengers.map((entry) => `${entry.passenger.firstName} ${entry.passenger.lastName}`);
              const pickupTasks = itinerary.transportTasks.filter((task) => task.taskType === "PICKUP");
              const dropoffTasks = itinerary.transportTasks.filter((task) => task.taskType === "DROPOFF");
              const accommodationNotes = itinerary.accommodations.map((item) => item.notes).filter(Boolean);
              const googleSheetsReviewRequired = itinerary.externalSyncLinks.some(
                (link) => link.provider === "google-sheets" && link.syncStatus === "REVIEW_REQUIRED",
              );

              return (
                <article
                  key={itinerary.id}
                  className="rounded-2xl border border-line bg-white p-5 shadow-sm"
                  style={{ display: "grid", gap: "1rem" }}
                >
                  <div className="row-card__title">
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold ${brand.accentClassName}`}>
                        {brand.code}
                      </div>
                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                          {itinerary.flightSegments.map((segment) => `${segment.departureAirport.code} → ${segment.arrivalAirport.code}`).join(" · ")}
                        </h3>
                        <div className="row-meta">
                          <span>{brand.name}</span>
                          {primarySegment ? <span>{formatDateTime(primarySegment.departureTimeLocal)}</span> : null}
                          <span>Updated {formatDateTime(itinerary.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span className="pill">{itinerary.status}</span>
                      {role !== "PASSENGER" && googleSheetsReviewRequired ? (
                        <span className="pill" style={{ background: "rgba(217, 119, 6, 0.12)", color: "rgb(146, 64, 14)" }}>
                          Sync review required
                        </span>
                      ) : null}
                      {role !== "PASSENGER" ? (
                        <Link className="button-secondary" href={`/itineraries/${itinerary.id}/edit`}>
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                    <div style={{ display: "grid", gap: "0.85rem" }}>
                      {itinerary.flightSegments.map((segment) => (
                        <div key={segment.id} className="rounded-xl border border-line bg-slate-50 p-4">
                          <div style={{ display: "grid", gap: "1rem" }}>
                            <div className="row-card__title">
                              <div>
                                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>{segment.flightNumber}</strong>
                                <p style={{ margin: "0.2rem 0 0", color: "var(--slate-500)" }}>{segment.airline}</p>
                              </div>
                            </div>
                            <DetailRow
                              label="Departure"
                              value={formatAirportSummary(segment.departureAirport)}
                              secondaryValue={formatDateTime(segment.departureTimeLocal)}
                            />
                            <DetailRow
                              label="Arrival"
                              value={formatAirportSummary(segment.arrivalAirport)}
                              secondaryValue={formatDateTime(segment.arrivalTimeLocal)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      <DetailRow label="Passengers" value={passengerNames.join(", ")} />
                      {pickupTasks.length > 0 ? (
                        <DetailRow
                          label="Pickup"
                          value={pickupTasks.map((task) => `${task.airport.code}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || task.status}`).join(" · ")}
                        />
                      ) : null}
                      {dropoffTasks.length > 0 ? (
                        <DetailRow
                          label="Dropoff"
                          value={dropoffTasks.map((task) => `${task.airport.code}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || task.status}`).join(" · ")}
                        />
                      ) : null}
                      {accommodationNotes.length > 0 ? <DetailRow label="Accommodation" value={accommodationNotes.join(" · ")} /> : null}
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

function DetailRow({ label, value, secondaryValue }: { label: string; value: string; secondaryValue?: string }) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div className="rounded-xl border border-line bg-slate-50 p-4">
      <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>{label}</p>
      <p style={{ color: "var(--slate-700)", margin: 0 }}>{value}</p>
      {secondaryValue ? (
        <p style={{ color: "var(--slate-500)", marginTop: "0.35rem" }}>{secondaryValue}</p>
      ) : null}
    </div>
  );
}
