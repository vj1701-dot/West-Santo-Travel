import { listAirports, listItineraries, listPassengerItineraries, listPassengers } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getAirlineBrand } from "@/lib/airlines";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatAirportSummary(airport: { code: string; name: string; city: string | null | undefined }) {
  return `${airport.code} - ${airport.name}${airport.city ? `, ${airport.city}` : ""}`;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ previewRole?: string; passengerId?: string; airportId?: string }>;
}) {
  const currentUser = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedPassengerId = resolvedSearchParams.passengerId ?? "";
  const selectedAirportId = resolvedSearchParams.airportId ?? "";
  const effectiveRole =
    currentUser.role === "ADMIN" && ["ADMIN", "COORDINATOR", "PASSENGER"].includes(resolvedSearchParams.previewRole ?? "")
      ? (resolvedSearchParams.previewRole as "ADMIN" | "COORDINATOR" | "PASSENGER")
      : currentUser.role;
  const [passengers, airports] = await Promise.all([listPassengers(), listAirports()]);
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
      const nextSegment = itinerary.flightSegments
        .filter((segment) => segment.departureTimeUtc >= new Date())
        .sort((a, b) => a.departureTimeUtc.getTime() - b.departureTimeUtc.getTime())[0] ?? itinerary.flightSegments[0];

      return {
        itinerary,
        nextSegment,
      };
    })
    .filter((item) => item.nextSegment)
    .sort((a, b) => a.nextSegment!.departureTimeUtc.getTime() - b.nextSegment!.departureTimeUtc.getTime())
    .slice(0, 8);

  return (
    <AppShell currentUser={currentUser} effectiveRole={effectiveRole}>
      <PageHeader
        title="Upcoming Trips"
        tooltip="Upcoming itineraries and trip readiness"
        eyebrow={effectiveRole === "PASSENGER" ? "Passenger View" : "Operations"}
        description={
          effectiveRole === "PASSENGER"
            ? "Your next itineraries in one place."
            : "Upcoming flights and trip readiness."
        }
      />

      {effectiveRole !== "PASSENGER" ? (
        <form className="compact-card" method="GET" style={{ marginBottom: "1rem", display: "grid", gap: "1rem" }}>
          {resolvedSearchParams.previewRole ? <input name="previewRole" type="hidden" value={resolvedSearchParams.previewRole} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="submit">Apply filters</button>
            <a className="button-secondary" href={resolvedSearchParams.previewRole ? `/?previewRole=${resolvedSearchParams.previewRole}` : "/"}>
              Clear
            </a>
          </div>
        </form>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {upcomingTrips.map(({ itinerary, nextSegment }) => (
          <article key={itinerary.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="row-card__title">
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold ${getAirlineBrand(nextSegment?.airline ?? "").accentClassName}`}>
                  {getAirlineBrand(nextSegment?.airline ?? "").code}
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600" }}>
                    {itinerary.flightSegments.map((segment) => `${segment.departureAirport.code} → ${segment.arrivalAirport.code}`).join(" · ")}
                  </h3>
                  <p style={{ color: "var(--slate-500)", fontSize: "0.875rem" }}>
                    {itinerary.flightSegments.map((segment) => segment.flightNumber).join(", ")}
                  </p>
                </div>
              </div>
              <span className="pill">{itinerary.status}</span>
            </div>

            <div className="grid gap-3" style={{ marginTop: "1rem" }}>
              <div
                style={{
                  display: "grid",
                  gap: "0.9rem",
                  padding: "1rem",
                  border: "1px solid var(--line)",
                  borderRadius: "1rem",
                  background: "var(--bg-soft)",
                }}
              >
                <InfoRow label="Airline" value={nextSegment?.airline ?? ""} borderless />
                {nextSegment ? (
                  <InfoRow
                    label="Departure"
                    value={formatAirportSummary(nextSegment.departureAirport)}
                    secondaryValue={formatDateTime(nextSegment.departureTimeLocal)}
                    borderless
                  />
                ) : null}
                {nextSegment ? (
                  <InfoRow
                    label="Arrival"
                    value={formatAirportSummary(nextSegment.arrivalAirport)}
                    secondaryValue={formatDateTime(nextSegment.arrivalTimeLocal)}
                    borderless
                  />
                ) : null}
                <InfoRow label="Passengers" value={itinerary.itineraryPassengers.map((item) => `${item.passenger.firstName} ${item.passenger.lastName}`).join(", ")} borderless />
                {itinerary.transportTasks.length > 0 ? (
                  <InfoRow
                    label="Transport"
                    value={itinerary.transportTasks
                      .map((task) => `${task.taskType}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || task.status}`)
                      .join(" · ")}
                    borderless
                  />
                ) : null}
                {itinerary.notes ? <InfoRow label="Trip note" value={itinerary.notes} borderless /> : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

function InfoRow({
  label,
  value,
  secondaryValue,
  borderless = false,
}: {
  label: string;
  value: string;
  secondaryValue?: string;
  borderless?: boolean;
}) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "0.2rem",
        paddingBottom: borderless ? 0 : "0.75rem",
        borderBottom: borderless ? "none" : "1px solid var(--line)",
      }}
      >
      <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--slate-500)" }}>
        {label}
      </span>
      <strong style={{ fontSize: "0.95rem", color: "var(--slate-800)" }}>{value}</strong>
      {secondaryValue ? <span style={{ color: "var(--slate-500)" }}>{secondaryValue}</span> : null}
    </div>
  );
}
