"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { PUBLIC_OPT_IN_CONSENT_TEXT } from "@/lib/public-opt-in";

type OptInRole = "PASSENGER" | "DRIVER";

export function PublicOptInForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<OptInRole>("PASSENGER");
  const [hasMessagingConsent, setHasMessagingConsent] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedRole, setSubmittedRole] = useState<OptInRole>("PASSENGER");

  function resetForm() {
    setFullName("");
    setPhone("");
    setRole("PASSENGER");
    setHasMessagingConsent(false);
  }

  async function handleSubmit() {
    if (!fullName.trim()) {
      setMessage("Enter your full name.");
      return;
    }

    if (!phone.trim()) {
      setMessage("Enter your phone number.");
      return;
    }

    if (!hasMessagingConsent) {
      setMessage("You must agree to receive operational SMS/MMS messages before submitting.");
      return;
    }

    const response = await fetch("/api/public-opt-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        hasMessagingConsent,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to submit opt-in.");
      return;
    }

    setMessage("Your SMS opt-in has been received.");
    setSubmittedRole(role);
    setIsSuccess(true);
    resetForm();
  }

  return (
    <section className="dashboard-card stack" style={{ maxWidth: "720px", margin: "0 auto" }}>
      {message ? (
        <div className="compact-card">
          <p>{message}</p>
        </div>
      ) : null}

      <div>
        <p className="eyebrow">Public Enrollment</p>
        <h2 style={{ marginTop: "0.35rem", color: "var(--ink-900)", fontSize: "1.25rem" }}>SMS Opt-In</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Full name</span>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label className="field">
          <span>Phone number</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={role} onChange={(event) => setRole(event.target.value as OptInRole)}>
            <option value="PASSENGER">Passenger</option>
            <option value="DRIVER">Driver</option>
          </select>
        </label>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "0.9rem 1rem",
          border: "1px solid var(--accent-200)",
          borderRadius: "14px",
          background: "rgba(255, 255, 255, 0.92)",
          color: "var(--ink-700)",
          lineHeight: 1.6,
        }}
      >
        <input
          checked={hasMessagingConsent}
          onChange={(event) => setHasMessagingConsent(event.target.checked)}
          style={{ marginTop: "0.2rem" }}
          type="checkbox"
        />
        <span>
          {PUBLIC_OPT_IN_CONSENT_TEXT} View the <Link href="/privacy-policy">Privacy Policy</Link> and{" "}
          <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>.
        </span>
      </label>

      {isSuccess ? (
        <p className="notes">You can now be added to travel coordination as a {submittedRole === "PASSENGER" ? "passenger" : "driver"}.</p>
      ) : (
        <p className="notes">No login is required. Use this page to enroll for operational travel text messages.</p>
      )}

      <div className="actions-row">
        <button disabled={isPending} type="button" onClick={() => startTransition(() => void handleSubmit())}>
          {isPending ? "Submitting..." : "Submit opt-in"}
        </button>
      </div>
    </section>
  );
}
