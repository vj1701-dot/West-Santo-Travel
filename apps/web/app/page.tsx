import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth/session";
import { dataAdapter } from "@/lib/data/adapter";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const currentUser = await requireUser();
  const overview = await dataAdapter.getOverview();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Overview"
        title="West Region Santos flight control"
        description="A mobile-first operations console for itineraries, transport, approvals, and passenger visibility."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map((metric) => (
          <StatCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Upcoming activity</p>
              <h2>Flight pipeline</h2>
            </div>
            <span className="pill">{overview.upcomingItineraries.length} itineraries</span>
          </div>
          <div className="stack">
            {overview.upcomingItineraries.map((itinerary) => (
              <article key={itinerary.id} className="row-card">
                <div className="row-card__title">
                  <div>
                    <h3>{itinerary.route}</h3>
                    <p>
                      {itinerary.flightLabel} · {itinerary.departureDate}
                    </p>
                  </div>
                  <span className={`status status--${itinerary.statusTone}`}>
                    {itinerary.status}
                  </span>
                </div>
                <div className="row-meta">
                  <span>{itinerary.passengerSummary}</span>
                  <span>{itinerary.transportSummary}</span>
                  <span>{itinerary.mandir}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Operations</p>
              <h2>Live queue</h2>
            </div>
          </div>
          <div className="stack">
            {overview.queue.map((item) => (
              <article key={item.label} className="compact-card">
                <div className="compact-card__top">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
