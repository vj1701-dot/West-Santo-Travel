import { listAirports } from "@west-santo/data";

import { PublicSubmissionForm } from "@/components/public-submission-form";

export const dynamic = "force-dynamic";

export default async function SubmissionPage() {
  const airports = await listAirports();

  return (
    <main className="public-shell">
      <section className="public-hero" style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "1rem" }}>Submit Flight Details</h1>
        <p style={{ color: "var(--slate-600)", maxWidth: "680px", margin: "0 auto", lineHeight: "1.6" }}>
          Submit passenger and flight information for internal review. No login is required.
        </p>
      </section>
      <PublicSubmissionForm
        airports={airports.map((airport) => ({
          id: airport.id,
          code: airport.code,
          name: airport.name,
          city: airport.city,
          country: airport.country,
        }))}
      />
    </main>
  );
}
