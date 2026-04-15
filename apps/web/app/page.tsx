import { getDashboardSnapshot, listItineraries, listPassengerItineraries } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/tabs";
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
  const [dashboard, itineraries] = await Promise.all([
    getDashboardSnapshot(effectiveRole),
    effectiveRole === "PASSENGER" ? listPassengerItineraries(currentUser.id) : listItineraries(),
  ]);

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
        title="Dashboard"
        tooltip="Overview of upcoming trips, key metrics, and airport activity"
        eyebrow={effectiveRole === "PASSENGER" ? "Passenger View" : "Overview"}
        description={
          effectiveRole === "PASSENGER"
            ? "Your upcoming flights and reminders."
            : "Upcoming flights, quick operational metrics, and trip readiness."
        }
      />

      <Tabs defaultValue="trips">
        <TabsList>
          {effectiveRole !== "PASSENGER" ? <TabsTrigger value="overview">Overview</TabsTrigger> : null}
          <TabsTrigger value="trips" badge={upcomingTrips.length}>
            Upcoming Trips
          </TabsTrigger>
        </TabsList>

        {effectiveRole !== "PASSENGER" ? (
          <TabsContent value="overview">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {dashboard.metrics.map((metric) => (
                <StatCard key={metric.label} detail="Live snapshot" label={metric.label} value={String(metric.value)} />
              ))}
            </section>
          </TabsContent>
        ) : null}

        <TabsContent value="trips">
          <div className="grid gap-4 lg:grid-cols-2">
            {upcomingTrips.map(({ itinerary, nextSegment }) => (
              <article key={itinerary.id} className="trip-card">
                <div className="row-card__title">
                  <div>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: "600" }}>
                      {itinerary.flightSegments.map((segment) => `${segment.departureAirport.code} → ${segment.arrivalAirport.code}`).join(" · ")}
                    </h3>
                    <p style={{ color: "var(--slate-500)", fontSize: "0.875rem" }}>
                      {itinerary.flightSegments.map((segment) => segment.flightNumber).join(", ")}
                    </p>
                  </div>
                  <span className="pill">{itinerary.status}</span>
                </div>
                <div className="trip-card__grid">
                  <Info label="Next departure" value={formatDateTime(nextSegment?.departureTimeLocal)} />
                  <Info label="Passengers" value={String(itinerary.itineraryPassengers.length)} />
                  <Info label="Booking ID" value={itinerary.booking?.confirmationNumber ?? "Not entered"} />
                  <Info label="Price" value={itinerary.booking?.totalCost?.toString() ?? "Not entered"} />
                  <Info
                    label="Passenger names"
                    value={itinerary.itineraryPassengers.map((item) => `${item.passenger.firstName} ${item.passenger.lastName}`).join(", ")}
                  />
                  <Info
                    label="Accommodation"
                    value={itinerary.accommodations.map((item) => item.mandir.name).join(", ") || "No accommodation"}
                  />
                  <Info
                    label="Transport"
                    value={
                      itinerary.transportTasks.length > 0
                        ? itinerary.transportTasks.map((task) => `${task.taskType}: ${task.status}`).join(" · ")
                        : "No transport tasks"
                    }
                  />
                  <Info label="Notes" value={itinerary.notes ?? "No notes"} />
                </div>
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
