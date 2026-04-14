import { PublicSubmissionForm } from "@/components/public-submission-form";

export const dynamic = "force-dynamic";

export default function SubmitFlightPage() {
  return (
    <main className="public-shell">
      <section className="public-hero">
        <p className="eyebrow">Guest Submission</p>
        <h1>Submit santo flight details</h1>
        <p className="lead">
          Use this form to submit passenger and flight information for admin review. No login is required.
        </p>
      </section>
      <PublicSubmissionForm />
    </main>
  );
}
