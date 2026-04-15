import { PublicSubmissionForm } from "@/components/public-submission-form";

export const dynamic = "force-dynamic";

export default function SubmitFlightPage() {
  return (
    <main className="public-shell">
      <section className="public-hero" style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Guest Submission</p>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "1rem" }}>
          Submit Flight Details
        </h1>
        <p style={{ color: "var(--slate-600)", maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
          Submit passenger and flight information for admin review. No login required.
        </p>
      </section>
      <PublicSubmissionForm />
    </main>
  );
}
