import Link from "next/link";

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
        <p className="public-note">
          By submitting contact information, you agree that West Santo Travel may send operational SMS or MMS messages about travel reminders,
          schedule changes, and transport coordination. Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to opt
          out or <strong>HELP</strong> for help.
        </p>
        <div className="legal-nav" style={{ justifyContent: "center", marginTop: "1rem" }}>
          <Link className="button-secondary" href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className="button-secondary" href="/terms-and-conditions">
            Terms & Conditions
          </Link>
        </div>
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
