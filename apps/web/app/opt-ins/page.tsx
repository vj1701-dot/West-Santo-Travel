import { listPublicOptIns } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function formatSubmittedAt(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function OptInsPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }

  const optIns = await listPublicOptIns();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Directory"
        title="Public Opt-Ins"
        description="Recent public SMS consent records linked to passengers and drivers."
      />
      <section className="dashboard-card stack">
        {optIns.length === 0 ? (
          <p className="notes">No public opt-ins yet.</p>
        ) : (
          <div className="stack">
            {optIns.map((optIn) => (
              <article key={optIn.id} className="compact-card" style={{ padding: "1rem" }}>
                <div className="row-card__title">
                  <div>
                    <h3 style={{ margin: 0 }}>{optIn.fullName}</h3>
                    <p className="notes" style={{ marginTop: "0.35rem" }}>
                      {optIn.phone} · {optIn.role} · {formatSubmittedAt(optIn.submittedAt)}
                    </p>
                  </div>
                  <span className="pill">{optIn.role}</span>
                </div>
                <p className="notes" style={{ marginTop: "0.75rem" }}>
                  Linked record:{" "}
                  {optIn.passenger
                    ? `Passenger ${optIn.passenger.firstName} ${optIn.passenger.lastName}`.trim()
                    : optIn.driver
                      ? `Driver ${optIn.driver.name}`
                      : "None"}
                </p>
                <p className="notes">Source: {optIn.sourcePath}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
