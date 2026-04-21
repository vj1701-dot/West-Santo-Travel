"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RosterSnapshot = {
  passengers?: Array<{ id: string; name: string }>;
  pickupDriverName?: string | null;
  dropoffDriverName?: string | null;
};

type PendingRosterDiff = {
  syncedAt?: string;
  sourceRows?: number[];
  current?: RosterSnapshot;
  proposed?: RosterSnapshot;
};

function renderNames(items?: Array<{ id: string; name: string }>) {
  if (!items || items.length === 0) {
    return "None";
  }

  return items.map((item) => item.name).join(", ");
}

function formatDateTime(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function GoogleSheetsSyncReviewPanel({
  itineraryId,
  pendingRosterDiff,
}: {
  itineraryId: string;
  pendingRosterDiff: Record<string, unknown>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const diff = pendingRosterDiff as PendingRosterDiff;

  async function applyChanges() {
    const response = await fetch(`/api/itineraries/${itineraryId}/sync-review`, {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error?.message ?? "Unable to apply Google Sheets traveler changes.");
      return;
    }

    setMessage("Google Sheets traveler changes applied.");
    startTransition(() => {
      router.refresh();
    });
  }

  const syncedAt = formatDateTime(diff.syncedAt);
  const sourceRows = diff.sourceRows?.length ? diff.sourceRows.join(", ") : null;

  return (
    <section
      className="panel"
      style={{
        display: "grid",
        gap: "1rem",
        borderColor: "rgba(217, 119, 6, 0.35)",
        background: "linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 1))",
      }}
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">Google Sheets review required</p>
          <h2 style={{ marginBottom: "0.25rem" }}>Traveler or driver changes are pending</h2>
          <p className="notes" style={{ margin: 0 }}>
            Flight updates already synced. The roster change below is staged until you approve it.
          </p>
        </div>
        <button disabled={isPending} type="button" onClick={() => void applyChanges()}>
          Apply Google Sheets traveler changes
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            Current app roster
          </p>
          <p style={{ margin: "0 0 0.5rem" }}><strong>Passengers:</strong> {renderNames(diff.current?.passengers)}</p>
          <p style={{ margin: "0 0 0.35rem" }}>
            <strong>Pickup driver:</strong> {diff.current?.pickupDriverName ?? "None"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Dropoff driver:</strong> {diff.current?.dropoffDriverName ?? "None"}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            Proposed Google Sheets roster
          </p>
          <p style={{ margin: "0 0 0.5rem" }}><strong>Passengers:</strong> {renderNames(diff.proposed?.passengers)}</p>
          <p style={{ margin: "0 0 0.35rem" }}>
            <strong>Pickup driver:</strong> {diff.proposed?.pickupDriverName ?? "None"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Dropoff driver:</strong> {diff.proposed?.dropoffDriverName ?? "None"}
          </p>
        </div>
      </div>

      {(syncedAt || sourceRows || message) ? (
        <div className="notes" style={{ display: "grid", gap: "0.35rem" }}>
          {syncedAt ? <span>Latest sheet sync: {syncedAt}</span> : null}
          {sourceRows ? <span>Source rows: {sourceRows}</span> : null}
          {message ? <span>{message}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
