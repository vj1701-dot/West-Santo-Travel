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
    departureAirport: { code: string };
    arrivalAirport: { code: string };
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
  booking: {
    confirmationNumber: string | null;
    totalCost: { toString(): string } | null;
  } | null;
  accommodations: Array<{
    mandir: { name: string } | null;
    notes: string | null;
  }>;
  approvalRequests: Array<{
    id: string;
    status: string;
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
                      <div className="stack--tight">
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
                      {role !== "PASSENGER" ? (
                        <Link className="button-secondary" href={`/itineraries/${itinerary.id}/edit`}>
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                    <div className="stack--tight">
                      {itinerary.flightSegments.map((segment) => (
                        <div key={segment.id} className="rounded-xl border border-line bg-slate-50 p-4">
                          <div className="row-card__title">
                            <div>
                              <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>{segment.flightNumber}</strong>
                              <p style={{ margin: "0.2rem 0 0", color: "var(--slate-500)" }}>{segment.airline}</p>
                            </div>
                            <span style={{ fontSize: "0.875rem", color: "var(--slate-600)" }}>
                              {formatDateTime(segment.departureTimeLocal)}
                            </span>
                          </div>
                          <div className="row-meta" style={{ marginTop: "0.5rem" }}>
                            <span>{segment.departureAirport.code}</span>
                            <span>→</span>
                            <span>{segment.arrivalAirport.code}</span>
                            <span>{formatDateTime(segment.arrivalTimeLocal)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="stack--tight">
                      <DetailRow label="Passengers" value={passengerNames.join(", ")} />
                      {itinerary.booking?.confirmationNumber ? <DetailRow label="Booking ID" value={itinerary.booking.confirmationNumber} /> : null}
                      {itinerary.booking?.totalCost ? <DetailRow label="Total Price" value={itinerary.booking.totalCost.toString()} /> : null}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div className="rounded-xl border border-line bg-slate-50 p-4">
      <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>{label}</p>
      <p style={{ color: "var(--slate-700)" }}>{value}</p>
    </div>
  );
}
