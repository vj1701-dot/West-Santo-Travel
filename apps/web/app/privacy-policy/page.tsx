import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/legal-page-layout";

const LAST_UPDATED = "May 1, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy | West Santo Travel",
  description: "Privacy Policy for West Santo Travel SMS and MMS notifications.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      description="This policy explains how West Santo Travel collects, uses, and protects information submitted through this website and through related SMS and MMS travel notifications."
      lastUpdated={LAST_UPDATED}
      title="Privacy Policy"
    >
      <section className="legal-section">
        <h2>1. Scope</h2>
        <p>
          West Santo Travel uses this website and related messaging tools to coordinate flight itineraries, airport pickups and drop-offs,
          passenger updates, driver assignments, and operational reminders. This Privacy Policy applies to information collected through the
          website, internal travel coordination workflows, and SMS or MMS messages sent in connection with those services.
        </p>
      </section>

      <section className="legal-section">
        <h2>2. Information We Collect</h2>
        <ul className="legal-list">
          <li>Name, phone number, email address, and other contact information you provide.</li>
          <li>Flight, itinerary, airport, accommodation, and transport-related details submitted for coordination.</li>
          <li>Communication records, including message delivery status, opt-in history, and opt-out events.</li>
          <li>Technical and security data reasonably required to operate the website and protect the service.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. How We Use Information</h2>
        <ul className="legal-list">
          <li>To review and manage submitted travel information.</li>
          <li>To send trip-related reminders, schedule changes, pickup and drop-off notices, and other operational SMS or MMS messages.</li>
          <li>To support coordinators, passengers, drivers, and administrators involved in travel operations.</li>
          <li>To maintain internal audit logs, prevent misuse, troubleshoot issues, and improve system reliability.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. SMS And MMS Messaging Privacy</h2>
        <p>
          If you provide a mobile number to West Santo Travel, you agree that it may be used for operational messaging related to your travel
          or transport coordination. Message frequency varies based on itinerary activity. Message and data rates may apply.
        </p>
        <p>
          Mobile opt-in data, text messaging consent, and related contact information are not shared with third parties for their marketing
          purposes. You may opt out at any time by replying <strong>STOP</strong> to a message. For help, reply <strong>HELP</strong>.
        </p>
      </section>

      <section className="legal-section">
        <h2>5. How We Share Information</h2>
        <ul className="legal-list">
          <li>With authorized West Santo Travel administrators, coordinators, and assigned operational users who need the data to perform services.</li>
          <li>With service providers used to operate the platform, including hosting, authentication, database, and messaging providers such as Twilio.</li>
          <li>When required by law, regulation, legal process, or to protect the safety, rights, or integrity of the service.</li>
        </ul>
        <p>We do not sell personal information.</p>
      </section>

      <section className="legal-section">
        <h2>6. Data Retention And Security</h2>
        <p>
          We retain information for as long as reasonably necessary to operate the service, coordinate travel, maintain records, comply with
          legal obligations, and resolve disputes. We use reasonable administrative, technical, and organizational safeguards, but no system
          can guarantee absolute security.
        </p>
      </section>

      <section className="legal-section">
        <h2>7. Your Choices</h2>
        <ul className="legal-list">
          <li>You may decline to provide optional information, but some travel coordination features may not work without it.</li>
          <li>You may opt out of SMS or MMS messages at any time by replying <strong>STOP</strong>.</li>
          <li>You may request help with messaging by replying <strong>HELP</strong> or by contacting the West Santo Travel coordinator or organizer who enrolled you.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>8. Children&apos;s Privacy</h2>
        <p>
          This service is not intended as a general-audience consumer platform for children. Information about minors should only be submitted
          by a parent, guardian, or authorized travel coordinator when necessary for travel operations.
        </p>
      </section>

      <section className="legal-section">
        <h2>9. Changes To This Policy</h2>
        <p>
          West Santo Travel may update this Privacy Policy from time to time. Updated versions will be posted on this page with a revised
          effective date.
        </p>
      </section>

      <section className="legal-section">
        <h2>10. Contact</h2>
        <p>
          If you have questions about this Privacy Policy or about messaging through this service, contact the West Santo Travel coordinator,
          administrator, or organizer who provided your enrollment or travel instructions.
        </p>
      </section>
    </LegalPageLayout>
  );
}
