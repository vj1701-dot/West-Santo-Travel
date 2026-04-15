"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type PassengerRecord = {
  id: string;
  firstName: string;
  lastName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  passengerType: string;
  notes: string | null;
  telegramChatId: string | null;
  telegramUsername: string | null;
  itineraryCount: number;
};

export function PassengerManager({ passengers }: { passengers: PassengerRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(passengers[0]?.id ?? null);
  const selectedPassenger = passengers.find((passenger) => passenger.id === selectedId) ?? null;

  const filteredPassengers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return passengers;
    return passengers.filter((passenger) =>
      [
        passenger.firstName,
        passenger.lastName,
        passenger.legalName ?? "",
        passenger.email ?? "",
        passenger.phone ?? "",
        passenger.passengerType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [passengers, search]);

  async function submitJson(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Request failed.");
      return false;
    }

    setMessage("Saved.");
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Passengers</p>
          <h2>Roster and dietary notes</h2>
        </div>
      </div>
      {message ? <div className="compact-card"><p>{message}</p></div> : null}

      <div className="manager-layout">
        <div className="table-panel stack">
          <label className="field">
            <span>Search passengers</span>
            <input placeholder="Search by name, phone, email, or type" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <table className="data-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Type</th>
                <th>Trips</th>
                <th>Telegram</th>
              </tr>
            </thead>
            <tbody>
              {filteredPassengers.map((passenger) => (
                <tr
                  key={passenger.id}
                  className={selectedId === passenger.id ? "data-table__row--active" : ""}
                  onClick={() => setSelectedId(passenger.id)}
                >
                  <td>
                    <strong>{passenger.firstName} {passenger.lastName}</strong>
                    <div className="muted-inline">{passenger.phone ?? passenger.email ?? passenger.legalName ?? "No contact"}</div>
                  </td>
                  <td>{passenger.passengerType}</td>
                  <td>{passenger.itineraryCount}</td>
                  <td>{passenger.telegramChatId ? "Linked" : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="drawer-panel stack">
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const ok = await submitJson("/api/passengers", "POST", {
                firstName: form.get("firstName"),
                lastName: form.get("lastName"),
                legalName: form.get("legalName") || null,
                email: form.get("email") || null,
                phone: form.get("phone") || null,
                passengerType: form.get("passengerType"),
                notes: form.get("notes") || null,
              });
              if (ok) event.currentTarget.reset();
            }}
          >
            <h3>Add passenger</h3>
            <label className="field"><span>First name</span><input name="firstName" required /></label>
            <label className="field"><span>Last name</span><input name="lastName" required /></label>
            <label className="field"><span>Legal name</span><input name="legalName" /></label>
            <label className="field"><span>Email</span><input name="email" type="email" /></label>
            <label className="field"><span>Phone</span><input name="phone" /></label>
            <label className="field">
              <span>Passenger type</span>
              <select defaultValue="WEST_SANTO" name="passengerType">
                <option value="WEST_SANTO">West Santo</option>
                <option value="GUEST_SANTO">Guest Santo</option>
                <option value="HARIBHAKTO">Haribhakto</option>
                <option value="EXTRA_SEAT">Extra Seat</option>
              </select>
            </label>
            <label className="field"><span>Food / diet / notes</span><textarea name="notes" rows={4} /></label>
            <button disabled={isPending} type="submit">Create passenger</button>
          </form>

          {selectedPassenger ? (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                await submitJson(`/api/passengers/${selectedPassenger.id}`, "PATCH", {
                  firstName: form.get("firstName"),
                  lastName: form.get("lastName"),
                  legalName: form.get("legalName") || null,
                  email: form.get("email") || null,
                  phone: form.get("phone") || null,
                  passengerType: form.get("passengerType"),
                  notes: form.get("notes") || null,
                });
              }}
            >
              <h3>Passenger details</h3>
              <div className="info-grid">
                <Info label="Trip count" value={String(selectedPassenger.itineraryCount)} />
                <Info label="Telegram" value={selectedPassenger.telegramChatId ?? "Not linked"} />
              </div>
              <label className="field"><span>First name</span><input defaultValue={selectedPassenger.firstName} name="firstName" required /></label>
              <label className="field"><span>Last name</span><input defaultValue={selectedPassenger.lastName} name="lastName" required /></label>
              <label className="field"><span>Legal name</span><input defaultValue={selectedPassenger.legalName ?? ""} name="legalName" /></label>
              <label className="field"><span>Email</span><input defaultValue={selectedPassenger.email ?? ""} name="email" type="email" /></label>
              <label className="field"><span>Phone</span><input defaultValue={selectedPassenger.phone ?? ""} name="phone" /></label>
              <label className="field">
                <span>Passenger type</span>
                <select defaultValue={selectedPassenger.passengerType} name="passengerType">
                  <option value="WEST_SANTO">West Santo</option>
                  <option value="GUEST_SANTO">Guest Santo</option>
                  <option value="HARIBHAKTO">Haribhakto</option>
                  <option value="EXTRA_SEAT">Extra Seat</option>
                </select>
              </label>
              <label className="field"><span>Food / diet / notes</span><textarea defaultValue={selectedPassenger.notes ?? ""} name="notes" rows={4} /></label>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="field"><span>Telegram chat ID</span><input name="chatId" placeholder={selectedPassenger.telegramChatId ?? "Enter chat ID"} /></label>
                <label className="field"><span>Telegram username</span><input defaultValue={selectedPassenger.telegramUsername ?? ""} name="telegramUsername" /></label>
                <button
                  className="button-secondary"
                  disabled={isPending}
                  type="button"
                  onClick={async (event) => {
                    const formElement = event.currentTarget.form;
                    if (!formElement) return;
                    const form = new FormData(formElement);
                    const chatId = String(form.get("chatId") ?? "").trim();
                    if (!chatId) {
                      setMessage("Enter a chat ID to link Telegram.");
                      return;
                    }
                    await submitJson("/api/telegram-links", "POST", {
                      entityType: "PASSENGER",
                      entityId: selectedPassenger.id,
                      chatId,
                      telegramUsername: String(form.get("telegramUsername") ?? "").trim() || null,
                    });
                  }}
                >
                  Link Telegram
                </button>
              </div>
              <button disabled={isPending} type="submit">Save passenger</button>
            </form>
          ) : null}
        </div>
      </div>
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
