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
      <section
        className="dashboard-card stack"
        style={{
          maxWidth: "900px",
          margin: "0 auto 1.5rem",
          background: "rgba(255, 255, 255, 0.94)",
        }}
      >
        <div>
          <p className="eyebrow">Messaging Consent</p>
          <h2 style={{ marginTop: "0.35rem", color: "var(--ink-900)", fontSize: "1.25rem" }}>How text message consent works</h2>
        </div>
        <ol style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--ink-700)", lineHeight: 1.7 }}>
          <li>Visit this public page and enter travel details and the mobile phone number(s) to be used for coordination.</li>
          <li>Review the SMS/MMS disclosure and the links to the Privacy Policy and Terms &amp; Conditions.</li>
          <li>Check the consent box before submitting the form. The form cannot be submitted without that consent.</li>
          <li>After consent is given, West Santo Travel may send operational travel reminders, schedule updates, and transport coordination messages.</li>
        </ol>
        <p className="notes">
          No login is required. Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to opt out or <strong>HELP</strong> for help.
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
