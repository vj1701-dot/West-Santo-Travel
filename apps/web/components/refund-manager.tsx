"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type PassengerOption = {
  id: string;
  name: string;
};

type RefundRecord = {
  id: string;
  amount: number;
  refundedAt: string;
  note: string | null;
  recordedBy: string | null;
  allocations: Array<{
    passengerName: string;
    amount: number;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function RefundManager({
  itineraryId,
  hasTripCost,
  passengers,
  refunds,
}: {
  itineraryId: string;
  hasTripCost: boolean;
  passengers: PassengerOption[];
  refunds: RefundRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [refundedAt, setRefundedAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [passengerId, setPassengerId] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch(`/api/itineraries/${itineraryId}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        refundedAt,
        note: note.trim() || null,
        passengerId: passengerId || null,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error?.message ?? "Unable to save refund.");
      return;
    }

    setAmount("");
    setNote("");
    setPassengerId("");
    setMessage("Refund saved.");
    startTransition(() => router.refresh());
  }

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Refunds</p>
          <h2>Track itinerary and passenger refunds</h2>
        </div>
      </div>

      {!hasTripCost ? (
        <div className="compact-card">
          <p>Add a total trip cost before recording refunds.</p>
        </div>
      ) : (
        <form className="compact-card stack" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">
              <span>Refund amount</span>
              <input min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
            <label className="field">
              <span>Refund date</span>
              <input type="date" value={refundedAt} onChange={(event) => setRefundedAt(event.target.value)} required />
            </label>
            <label className="field">
              <span>Refund scope</span>
              <select value={passengerId} onChange={(event) => setPassengerId(event.target.value)}>
                <option value="">Full itinerary</option>
                {passengers.map((passenger) => (
                  <option key={passenger.id} value={passenger.id}>
                    {passenger.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Note</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason, ticket credit, or refund reference" />
            </label>
          </div>
          {message ? <p className="notes">{message}</p> : null}
          <div className="actions-row" style={{ marginTop: 0 }}>
            <button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Record refund"}
            </button>
          </div>
        </form>
      )}

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Scope</th>
              <th>Recorded By</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr key={refund.id}>
                <td>{refund.refundedAt}</td>
                <td>{formatCurrency(refund.amount)}</td>
                <td>{refund.allocations.map((item) => `${item.passengerName} (${formatCurrency(item.amount)})`).join(", ")}</td>
                <td>{refund.recordedBy ?? "Unknown"}</td>
                <td>{refund.note ?? "—"}</td>
              </tr>
            ))}
            {refunds.length === 0 ? (
              <tr>
                <td colSpan={5}>No refunds recorded.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
