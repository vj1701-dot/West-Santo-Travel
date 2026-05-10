import Link from "next/link";

import { PublicOptInForm } from "@/components/public-opt-in-form";

export const dynamic = "force-dynamic";

export default function OptInPage() {
  return (
    <main className="public-shell">
      <section className="public-hero" style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "1rem" }}>SMS Opt-In</h1>
        <p style={{ color: "var(--slate-600)", maxWidth: "680px", margin: "0 auto", lineHeight: "1.6" }}>
          Enroll as a passenger or driver to receive West Santo Travel operational text messages. No login is required.
        </p>
        <p className="public-note">
          By opting in, you agree that West Santo Travel may send operational SMS or MMS messages about travel reminders, schedule changes, and
          transport coordination. Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to opt out or{" "}
          <strong>HELP</strong> for help.
        </p>
        <div className="legal-nav" style={{ justifyContent: "center", marginTop: "1rem" }}>
          <Link className="button-secondary" href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className="button-secondary" href="/terms-and-conditions">
            Terms &amp; Conditions
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
          <li>Enter your full name, mobile phone number, and whether you are enrolling as a passenger or driver.</li>
          <li>Review the SMS/MMS disclosure and the links to the Privacy Policy and Terms &amp; Conditions.</li>
          <li>Check the consent box before submitting the form. The form cannot be submitted without that consent.</li>
          <li>After consent is given, West Santo Travel may send operational travel reminders, schedule updates, and transport coordination messages.</li>
        </ol>
        <p className="notes">
          No login is required. Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to opt out or{" "}
          <strong>HELP</strong> for help.
        </p>
      </section>
      <PublicOptInForm />
    </main>
  );
}
