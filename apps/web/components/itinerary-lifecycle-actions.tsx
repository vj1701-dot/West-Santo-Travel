"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ItineraryLifecycleActions({
  itineraryId,
  isArchived,
  role,
}: {
  itineraryId: string;
  isArchived: boolean;
  role: "ADMIN" | "COORDINATOR";
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function archiveItinerary() {
    const response = await fetch(`/api/itineraries/${itineraryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "CANCELLED",
        isArchived: true,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error?.message ?? "Unable to archive itinerary.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function unarchiveItinerary() {
    const response = await fetch(`/api/itineraries/${itineraryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isArchived: false,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error?.message ?? "Unable to unarchive itinerary.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function deletePermanently() {
    const confirmed = window.confirm("Delete this itinerary permanently? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/itineraries/${itineraryId}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error?.message ?? "Unable to delete itinerary.");
      return;
    }

    startTransition(() => {
      router.push("/itineraries");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: "0.5rem", justifyItems: "end" }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {isArchived ? (
          <button className="button-secondary" disabled={isPending} onClick={() => void unarchiveItinerary()} type="button">
            Unarchive
          </button>
        ) : (
          <button className="button-secondary" disabled={isPending} onClick={() => void archiveItinerary()} type="button">
            Cancel & archive
          </button>
        )}
        {role === "ADMIN" ? (
          <button disabled={isPending} onClick={() => void deletePermanently()} type="button">
            Delete permanently
          </button>
        ) : null}
      </div>
      {message ? <span className="notes">{message}</span> : null}
    </div>
  );
}
