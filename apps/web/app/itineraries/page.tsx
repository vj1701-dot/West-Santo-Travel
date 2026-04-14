import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { dataAdapter } from "@/lib/data/adapter";

export const dynamic = "force-dynamic";

export default async function ItinerariesPage() {
  const currentUser = await requireUser();
  const itineraries = await dataAdapter.listItineraries();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Itineraries"
        title="Parent records for every flight flow"
        description="Track segments, approvals, transport generation, and passenger composition from one itinerary view."
      />

      <section className="stack">
        {itineraries.map((itinerary) => (
          <article key={itinerary.id} className="panel itinerary-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">{itinerary.code}</p>
                <h2>{itinerary.route}</h2>
              </div>
              <span className={`status status--${itinerary.statusTone}`}>{itinerary.status}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Flight" value={itinerary.flightLabel} />
              <Info label="Passengers" value={itinerary.passengerCount} />
              <Info label="Transport" value={itinerary.transportSummary} />
              <Info label="Approval" value={itinerary.approvalState} />
            </div>
            <div className="segment-list">
              {itinerary.segments.map((segment) => (
                <div key={segment.id} className="segment">
                  <div>
                    <strong>{segment.airline}</strong>
                    <p>{segment.flightNumber}</p>
                  </div>
                  <div>
                    <strong>{segment.route}</strong>
                    <p>
                      {segment.departureTime} → {segment.arrivalTime}
                    </p>
                  </div>
                  <p className="muted">{segment.notes}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
