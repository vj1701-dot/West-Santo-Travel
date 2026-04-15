import { listItineraries, listPassengerItineraries } from "@west-santo/data";

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

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ previewRole?: string }>;
}) {
  const currentUser = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const effectiveRole =
    currentUser.role === "ADMIN" && ["ADMIN", "COORDINATOR", "PASSENGER"].includes(resolvedSearchParams.previewRole ?? "")
      ? (resolvedSearchParams.previewRole as "ADMIN" | "COORDINATOR" | "PASSENGER")
      : currentUser.role;
  const itineraries = await (effectiveRole === "PASSENGER" ? listPassengerItineraries(currentUser.id) : listItineraries());

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
              <InfoRow label="Airline" value={nextSegment?.airline ?? ""} />
              <InfoRow label="Next departure" value={formatDateTime(nextSegment?.departureTimeLocal)} />
              <InfoRow label="Passengers" value={itinerary.itineraryPassengers.map((item) => `${item.passenger.firstName} ${item.passenger.lastName}`).join(", ")} />
              {itinerary.booking?.confirmationNumber ? <InfoRow label="Booking ID" value={itinerary.booking.confirmationNumber} /> : null}
              {itinerary.booking?.totalCost ? <InfoRow label="Price" value={itinerary.booking.totalCost.toString()} /> : null}
              {itinerary.accommodations.length > 0 && itinerary.accommodations.some((item) => item.notes || item.mandir) ? (
                <InfoRow
                  label="Accommodation"
                  value={itinerary.accommodations.map((item) => item.notes || item.mandir?.name).filter(Boolean).join(" · ")}
                />
              ) : null}
              {itinerary.transportTasks.length > 0 ? (
                <InfoRow
                  label="Transport"
                  value={itinerary.transportTasks
                    .map((task) => `${task.taskType}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || task.status}`)
                    .join(" · ")}
                />
              ) : null}
              {itinerary.notes ? <InfoRow label="Trip note" value={itinerary.notes} /> : null}
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "0.2rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--slate-500)" }}>
        {label}
      </span>
      <strong style={{ fontSize: "0.95rem", color: "var(--slate-800)" }}>{value}</strong>
    </div>
  );
}
