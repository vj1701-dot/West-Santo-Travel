import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { dataAdapter } from "@/lib/data/adapter";

export const dynamic = "force-dynamic";

export default async function PassengersPage() {
  const currentUser = await requireUser();
  const passengers = await dataAdapter.listPassengers();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Passengers"
        title="Roster and visibility by traveler type"
        description="Keep guest santos, haribhakto, extra seats, and linked passengers distinct while preserving minimal public exposure."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {passengers.map((passenger) => (
          <article key={passenger.id} className="panel passenger-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">{passenger.passengerType}</p>
                <h2>{passenger.name}</h2>
              </div>
              <span className="pill">{passenger.itineraryCount} itineraries</span>
            </div>
            <div className="stack stack--tight">
              <Info label="Legal name" value={passenger.legalName} />
              <Info label="Contact" value={passenger.contact} />
              <Info label="Telegram" value={passenger.telegram} />
            </div>
            <p className="notes">{passenger.notes}</p>
          </article>
        ))}
      </section>
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
