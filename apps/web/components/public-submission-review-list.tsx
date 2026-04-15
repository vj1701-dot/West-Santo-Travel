"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type SubmissionRecord = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  rawPayload: unknown;
  normalizedPayload: unknown;
  reviewedByUser: {
    firstName: string;
    lastName: string;
  } | null;
};

type ParsedSubmissionPayload = {
  submitterName?: string | null;
  submitterPhone?: string | null;
  passengers?: Array<{
    firstName: string;
    lastName: string;
    phone?: string | null;
    passengerType?: string;
  }>;
  segments?: Array<{
    airline: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureTimeLocal: string;
    arrivalTimeLocal: string;
  }>;
};

function formatDateTime(value: Date | null) {
  if (!value) return "Not reviewed";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PublicSubmissionReviewList({ submissions }: { submissions: SubmissionRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const visibleSubmissions = useMemo(() => {
    if (statusFilter === "ALL") return submissions;
    return submissions.filter((submission) => submission.status === statusFilter);
  }, [submissions, statusFilter]);

  async function reviewSubmission(id: string, status: "APPROVED" | "REJECTED" | "DUPLICATE_FLAGGED", reviewNote: string) {
    const response = await fetch(`/api/public-submissions/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote: reviewNote || null }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Review failed.");
    }

    setMessage(`Submission ${status.toLowerCase()}.`);
    startTransition(() => router.refresh());
  }

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Admin Intake</p>
          <h2>Review public flight submissions</h2>
        </div>
        <label className="field transport-filter">
          <span>Status filter</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="DUPLICATE_FLAGGED">Duplicate flagged</option>
          </select>
        </label>
      </div>

      {message ? <div className="compact-card"><p>{message}</p></div> : null}

      {visibleSubmissions.map((submission) => {
        const payload = ((submission.normalizedPayload ?? submission.rawPayload) ?? {}) as ParsedSubmissionPayload;
        return (
          <article key={submission.id} className="trip-card">
            <div className="row-card__title">
              <div className="stack--tight">
                <h3>{payload.submitterName ?? "Unknown submitter"}</h3>
                <div className="row-meta">
                  <span>{payload.submitterPhone ?? "No phone"}</span>
                  <span>{formatDateTime(submission.createdAt)}</span>
                  <span>{(payload.passengers ?? []).length} passengers</span>
                  <span>{(payload.segments ?? []).length} segments</span>
                </div>
              </div>
              <span className="pill">{submission.status}</span>
            </div>

            <div className="detail-grid">
              <div className="detail-section">
                <p className="eyebrow">Passengers</p>
                <ul className="detail-list">
                  {(payload.passengers ?? []).map((passenger, index) => (
                    <li key={`${submission.id}-passenger-${index}`}>
                      <strong>{passenger.firstName} {passenger.lastName}</strong>
                      <span>{passenger.passengerType ?? "Unknown type"} · {passenger.phone ?? "No phone"}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="detail-section">
                <p className="eyebrow">Segments</p>
                <ul className="detail-list">
                  {(payload.segments ?? []).map((segment, index) => (
                    <li key={`${submission.id}-segment-${index}`}>
                      <strong>{segment.flightNumber}</strong>
                      <span>
                        {segment.departureAirport} {"->"} {segment.arrivalAirport} · {segment.departureTimeLocal}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="detail-section">
                <p className="eyebrow">Review Status</p>
                <ul className="detail-list">
                  <li>
                    <strong>Reviewed at</strong>
                    <span>{formatDateTime(submission.reviewedAt)}</span>
                  </li>
                  <li>
                    <strong>Reviewed by</strong>
                    <span>
                      {submission.reviewedByUser
                        ? `${submission.reviewedByUser.firstName} ${submission.reviewedByUser.lastName}`
                        : "Pending"}
                    </span>
                  </li>
                  {submission.notes ? (
                    <li>
                      <strong>Notes</strong>
                      <span>{submission.notes}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>

            {submission.status === "PENDING" ? (
              <form
                className="admin-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const status = String(form.get("status") ?? "") as "APPROVED" | "REJECTED" | "DUPLICATE_FLAGGED";
                  const reviewNote = String(form.get("reviewNote") ?? "");

                  try {
                    await reviewSubmission(submission.id, status, reviewNote);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Review failed.");
                  }
                }}
              >
                <input name="reviewNote" placeholder="Review note" />
                <button disabled={isPending} name="status" type="submit" value="APPROVED">Approve</button>
                <button disabled={isPending} name="status" type="submit" value="REJECTED">Reject</button>
                <button disabled={isPending} name="status" type="submit" value="DUPLICATE_FLAGGED">Flag duplicate</button>
              </form>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
