import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/legal-page-layout";

const LAST_UPDATED = "May 1, 2026";

export const metadata: Metadata = {
  title: "Terms and Conditions | West Santo Travel",
  description: "Terms and Conditions for West Santo Travel website access and SMS/MMS notifications.",
};

export default function TermsAndConditionsPage() {
  return (
    <LegalPageLayout
      description="These terms govern use of the West Santo Travel website and any related SMS or MMS messages used for travel coordination and operational reminders."
      lastUpdated={LAST_UPDATED}
      title="Terms & Conditions"
    >
      <section className="legal-section">
        <h2>1. Acceptance Of Terms</h2>
        <p>
          By using this website, submitting travel information, or enrolling a phone number for trip-related notifications, you agree to
          these Terms & Conditions. If you do not agree, do not use the service.
        </p>
      </section>

      <section className="legal-section">
        <h2>2. Service Description</h2>
        <p>
          West Santo Travel provides a travel coordination and operations platform for itineraries, airport transport, reminders, and related
          internal communications. The service is intended for operational use and convenience, not for emergency communications.
        </p>
      </section>

      <section className="legal-section">
        <h2>3. SMS And MMS Messaging Terms</h2>
        <ul className="legal-list">
          <li>By providing your mobile number, you consent to receive operational SMS or MMS messages related to travel and transport coordination.</li>
          <li>These messages may include itinerary reminders, schedule changes, pickup or drop-off updates, and coordinator notices.</li>
          <li>Message frequency varies according to your travel activity and related operations.</li>
          <li>Message and data rates may apply according to your wireless carrier plan.</li>
          <li>You may opt out at any time by replying <strong>STOP</strong>.</li>
          <li>You may request help by replying <strong>HELP</strong>.</li>
          <li>Carrier delivery is not guaranteed, and carriers are not liable for delayed or undelivered messages.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. User Responsibilities</h2>
        <ul className="legal-list">
          <li>You agree to provide accurate and current travel and contact information.</li>
          <li>You are responsible for ensuring that any phone number submitted is authorized for the recipient.</li>
          <li>You agree not to use the service for unlawful, abusive, misleading, or unauthorized purposes.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>5. Availability And Limitations</h2>
        <p>
          West Santo Travel may modify, suspend, or discontinue any part of the service at any time. The service is provided on an
          &quot;as is&quot; and &quot;as available&quot; basis without guarantees that it will always be uninterrupted, error-free, or suitable
          for every situation.
        </p>
      </section>

      <section className="legal-section">
        <h2>6. No Emergency Use</h2>
        <p>
          The website and related messages must not be relied on as an emergency service. If you have an emergency or time-critical safety
          issue, contact the appropriate emergency services or your coordinator directly through established emergency channels.
        </p>
      </section>

      <section className="legal-section">
        <h2>7. Privacy</h2>
        <p>
          Your use of the service is also governed by the <a href="/privacy-policy">Privacy Policy</a>, which describes how information is
          collected, used, and protected.
        </p>
      </section>

      <section className="legal-section">
        <h2>8. Changes To These Terms</h2>
        <p>
          West Santo Travel may update these Terms & Conditions at any time. Continued use of the service after changes are posted means you
          accept the updated terms.
        </p>
      </section>

      <section className="legal-section">
        <h2>9. Contact</h2>
        <p>
          Questions about these Terms & Conditions or SMS/MMS messaging may be directed to the West Santo Travel coordinator, administrator,
          or organizer who enrolled you or provided your travel instructions.
        </p>
      </section>
    </LegalPageLayout>
  );
}
