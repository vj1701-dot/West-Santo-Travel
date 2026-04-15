"use client";

type ItineraryRecord = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  itineraryPassengers: Array<{
    passenger: {
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
  }>;
  booking: {
    confirmationNumber: string | null;
    totalCost: { toString(): string } | null;
  } | null;
  accommodations: Array<{
    mandir: { name: string };
    room: string | null;
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
          <div className="stack">
            {itineraries.map((itinerary) => (
              <article key={itinerary.id} className="trip-card">
                <div className="row-card__title">
                  <div className="stack--tight">
                    <h3>
                      {itinerary.flightSegments.length > 0
                        ? itinerary.flightSegments
                            .map((segment) => `${segment.departureAirport.code} -> ${segment.arrivalAirport.code}`)
                            .join(" · ")
                        : "No flight segments"}
                    </h3>
                    <div className="row-meta">
                      <span>Updated {formatDateTime(itinerary.updatedAt)}</span>
                      <span>{itinerary.itineraryPassengers.length} passengers</span>
                      <span>{itinerary.flightSegments.length} segments</span>
                    </div>
                  </div>
                  <span className="pill">{itinerary.status}</span>
                </div>

                <div className="detail-grid">
                  <div className="detail-section">
                    <p className="eyebrow">Passengers</p>
                    <ul className="detail-list">
                      {itinerary.itineraryPassengers.map((entry) => (
                        <li key={`${itinerary.id}-${entry.passenger.firstName}-${entry.passenger.lastName}`}>
                          <strong>{entry.passenger.firstName} {entry.passenger.lastName}</strong>
                          <span>{entry.passenger.passengerType}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <p className="eyebrow">Flight Segments</p>
                    <ul className="detail-list">
                      {itinerary.flightSegments.map((segment) => (
                        <li key={segment.id}>
                          <strong>{segment.flightNumber}</strong>
                          <span>
                            {segment.departureAirport.code} {"->"} {segment.arrivalAirport.code} · {formatDateTime(segment.departureTimeLocal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <p className="eyebrow">Transport</p>
                    <ul className="detail-list">
                      {itinerary.transportTasks.length > 0 ? (
                        itinerary.transportTasks.map((task) => (
                          <li key={task.id}>
                            <strong>{task.taskType} · {task.status}</strong>
                            <span>
                              {task.airport.code} · {task.mandir?.name ?? "No mandir"} ·{" "}
                              {task.drivers.map((entry) => entry.driver.name).join(", ") || "Unassigned"}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li>
                          <strong>No transport tasks</strong>
                          <span>No pickup or drop-off records for this itinerary.</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <p className="eyebrow">Booking And Stay</p>
                    <ul className="detail-list">
                      <li>
                        <strong>Booking</strong>
                        <span>
                          {itinerary.booking?.confirmationNumber ?? "No confirmation"} ·{" "}
                          {itinerary.booking?.totalCost?.toString() ?? "No total cost"}
                        </span>
                      </li>
                      <li>
                        <strong>Accommodation</strong>
                        <span>
                          {itinerary.accommodations.map((stay) => `${stay.mandir.name}${stay.room ? ` · ${stay.room}` : ""}`).join(", ") ||
                            "No accommodation"}
                        </span>
                      </li>
                      <li>
                        <strong>Approvals</strong>
                        <span>
                          {itinerary.approvalRequests.length > 0
                            ? itinerary.approvalRequests.map((approval) => approval.status).join(", ")
                            : "No approval requests"}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {itinerary.notes ? <p className="notes">{itinerary.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
