"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ApprovalItem = {
  id: string;
  title: string;
  subject: string;
  requestedBy: string;
  requestedAt: string;
  impact: string;
  status: string;
  statusTone: "neutral" | "warning" | "success";
  deltas: string[];
};

export function ApprovalReviewList({
  approvals,
  canReview,
}: {
  approvals: ApprovalItem[];
  canReview: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submitReview(approvalId: string, status: "APPROVED" | "REJECTED", reviewComment: string) {
    const response = await fetch(`/api/approvals/${approvalId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        reviewComment: reviewComment || null,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Review failed.");
    }

    setMessage(`Approval ${status.toLowerCase()}.`);
    startTransition(() => router.refresh());
  }

  return (
    <section className="stack">
      {message ? <div className="panel"><strong>{message}</strong></div> : null}
      {approvals.map((approval) => (
        <article key={approval.id} className="panel approval-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{approval.subject}</p>
              <h2>{approval.title}</h2>
            </div>
            <span className={`status status--${approval.statusTone}`}>{approval.status}</span>
          </div>
          <div className="approval-grid">
            <Info label="Requested by" value={approval.requestedBy} />
            <Info label="Requested at" value={approval.requestedAt} />
            <Info label="Impact" value={approval.impact} />
          </div>
          <ul className="diff-list">
            {approval.deltas.map((delta) => (
              <li key={delta}>{delta}</li>
            ))}
          </ul>
          {canReview && approval.status === "PENDING" ? (
            <form
              className="admin-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const status = String(form.get("status") ?? "") as "APPROVED" | "REJECTED";
                const reviewComment = String(form.get("reviewComment") ?? "");

                try {
                  await submitReview(approval.id, status, reviewComment);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Review failed.");
                }
              }}
            >
              <input name="reviewComment" placeholder="Review comment" />
              <button disabled={isPending} name="status" type="submit" value="APPROVED">Approve</button>
              <button disabled={isPending} name="status" type="submit" value="REJECTED">Reject</button>
            </form>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
