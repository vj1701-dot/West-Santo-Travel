import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { dataAdapter } from "@/lib/data/adapter";

export const dynamic = "force-dynamic";

export default async function TransportTasksPage() {
  const currentUser = await requireUser();
  const tasks = await dataAdapter.listTransportTasks();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Transport tasks"
        title="Pickup and drop-off as separate work items"
        description="Each task carries airport, mandir, timing, status, drivers, and notes without merging the transport lifecycle."
      />

      <section className="stack">
        {tasks.map((task) => (
          <article key={task.id} className="panel task-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">{task.type}</p>
                <h2>{task.airport} to {task.mandir}</h2>
              </div>
              <span className={`status status--${task.statusTone}`}>{task.status}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Time" value={task.scheduledTime} />
              <Info label="Drivers" value={task.drivers.join(", ")} />
            </div>
            <p className="notes">{task.notes}</p>
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
