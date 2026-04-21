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

type FormState = {
  firstName: string;
  lastName: string;
  legalName: string;
  email: string;
  phone: string;
  passengerType: string;
  notes: string;
  chatId: string;
  telegramUsername: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  legalName: "",
  email: "",
  phone: "",
  passengerType: "WEST_SANTO",
  notes: "",
  chatId: "",
  telegramUsername: "",
};

function toFormState(passenger: PassengerRecord): FormState {
  return {
    firstName: passenger.firstName,
    lastName: passenger.lastName,
    legalName: passenger.legalName ?? "",
    email: passenger.email ?? "",
    phone: passenger.phone ?? "",
    passengerType: passenger.passengerType,
    notes: passenger.notes ?? "",
    chatId: "",
    telegramUsername: passenger.telegramUsername ?? "",
  };
}

export function PassengerManager({ passengers }: { passengers: PassengerRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [panelMode, setPanelMode] = useState<"create" | "edit" | null>(null);
  const [editingPassengerId, setEditingPassengerId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);

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

  const editingPassenger =
    panelMode === "edit" && editingPassengerId
      ? passengers.find((passenger) => passenger.id === editingPassengerId) ?? null
      : null;

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

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

  function closePanel() {
    setPanelMode(null);
    setEditingPassengerId(null);
    setFormState(emptyForm);
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submitJson("/api/passengers", "POST", {
      firstName: formState.firstName,
      lastName: formState.lastName,
      legalName: formState.legalName || null,
      email: formState.email || null,
      phone: formState.phone || null,
      passengerType: formState.passengerType,
      notes: formState.notes || null,
    });

    if (ok) {
      closePanel();
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPassenger) return;

    await submitJson(`/api/passengers/${editingPassenger.id}`, "PATCH", {
      firstName: formState.firstName,
      lastName: formState.lastName,
      legalName: formState.legalName || null,
      email: formState.email || null,
      phone: formState.phone || null,
      passengerType: formState.passengerType,
      notes: formState.notes || null,
    });
  }

  async function handleTelegramLink() {
    if (!editingPassenger) return;
    if (!formState.chatId.trim()) {
      setMessage("Enter a chat ID to link Telegram.");
      return;
    }

    await submitJson("/api/telegram-links", "POST", {
      entityType: "PASSENGER",
      entityId: editingPassenger.id,
      chatId: formState.chatId.trim(),
      telegramUsername: formState.telegramUsername.trim() || null,
    });
  }

  async function handleDelete(passenger: PassengerRecord) {
    if (!window.confirm(`Disable passenger ${passenger.firstName} ${passenger.lastName}?`)) {
      return;
    }

    const response = await fetch(`/api/passengers/${passenger.id}`, { method: "DELETE" });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to disable passenger.");
      return;
    }

    if (editingPassengerId === passenger.id) {
      closePanel();
    }
    setMessage("Passenger disabled.");
    startTransition(() => router.refresh());
  }

  return (
    <section className="panel stack">
      {message ? (
        <div className="compact-card">
          <p>{message}</p>
        </div>
      ) : null}

      <div className="manager-toolbar">
        <label className="field" style={{ flex: 1 }}>
          <span>Search passengers</span>
          <input
            placeholder="Search by name, phone, email, or type"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setPanelMode("create");
            setEditingPassengerId(null);
            setFormState(emptyForm);
          }}
        >
          Add Passenger
        </button>
      </div>

      {panelMode === "create" ? (
        <form className="compact-card stack" onSubmit={handleCreateSubmit}>
          <div className="row-card__title">
            <h3 style={{ margin: 0 }}>Add Passenger</h3>
            <button className="button-secondary" type="button" onClick={closePanel}>
              Cancel
            </button>
          </div>
          <PassengerFields formState={formState} onChange={updateField} />
          <div className="actions-row" style={{ marginTop: 0 }}>
            <button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Create passenger"}
            </button>
          </div>
        </form>
      ) : null}

      {panelMode === "edit" && editingPassenger ? (
        <form className="compact-card stack" onSubmit={handleEditSubmit}>
          <div className="row-card__title">
            <div>
              <h3 style={{ margin: 0 }}>
                Edit {editingPassenger.firstName} {editingPassenger.lastName}
              </h3>
              <p className="notes" style={{ marginTop: "0.35rem" }}>
                Trips: {editingPassenger.itineraryCount} · Telegram: {editingPassenger.telegramChatId ?? "Not linked"}
              </p>
            </div>
            <button className="button-secondary" type="button" onClick={closePanel}>
              Cancel
            </button>
          </div>
          <PassengerFields formState={formState} onChange={updateField} />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="field">
              <span>Telegram chat ID</span>
              <input
                name="chatId"
                placeholder={editingPassenger.telegramChatId ?? "Enter chat ID"}
                value={formState.chatId}
                onChange={(event) => updateField("chatId", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Telegram username</span>
              <input
                value={formState.telegramUsername}
                onChange={(event) => updateField("telegramUsername", event.target.value)}
              />
            </label>
            <button className="button-secondary" type="button" onClick={() => void handleTelegramLink()}>
              Link Telegram
            </button>
          </div>
          <div className="actions-row" style={{ marginTop: 0 }}>
            <button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Save passenger"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>Passenger</th>
              <th>Type</th>
              <th>Trips</th>
              <th>Telegram</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPassengers.map((passenger) => (
              <tr key={passenger.id}>
                <td>
                  <strong>
                    {passenger.firstName} {passenger.lastName}
                  </strong>
                  <div className="muted-inline">
                    {passenger.phone ?? passenger.email ?? passenger.legalName ?? "No contact"}
                  </div>
                </td>
                <td>{passenger.passengerType}</td>
                <td>{passenger.itineraryCount}</td>
                <td>{passenger.telegramChatId ? "Linked" : "Pending"}</td>
                <td>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Open edit form for ${passenger.firstName} ${passenger.lastName}?`)) {
                          return;
                        }
                        setPanelMode("edit");
                        setEditingPassengerId(passenger.id);
                        setFormState(toFormState(passenger));
                      }}
                    >
                      Edit
                    </button>
                    <button className="button-secondary" type="button" onClick={() => void handleDelete(passenger)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPassengers.length === 0 ? (
              <tr>
                <td colSpan={5}>No passengers found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mobile-only">
        {filteredPassengers.length === 0 ? (
          <div className="compact-card">
            <p>No passengers found.</p>
          </div>
        ) : (
          <div className="manager-list">
            {filteredPassengers.map((passenger) => (
              <article key={passenger.id} className="compact-card manager-card">
                <div className="manager-card__header">
                  <div>
                    <strong>
                      {passenger.firstName} {passenger.lastName}
                    </strong>
                    <div className="muted-inline">
                      {passenger.phone ?? passenger.email ?? passenger.legalName ?? "No contact"}
                    </div>
                  </div>
                </div>
                <div className="manager-card__body">
                  <div className="manager-card__meta">
                    <div>
                      <span>Type</span>
                      <strong>{passenger.passengerType}</strong>
                    </div>
                    <div>
                      <span>Trips</span>
                      <strong>{passenger.itineraryCount}</strong>
                    </div>
                    <div>
                      <span>Telegram</span>
                      <strong>{passenger.telegramChatId ? "Linked" : "Pending"}</strong>
                    </div>
                  </div>
                  <div className="manager-card__actions">
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Open edit form for ${passenger.firstName} ${passenger.lastName}?`)) {
                          return;
                        }
                        setPanelMode("edit");
                        setEditingPassengerId(passenger.id);
                        setFormState(toFormState(passenger));
                      }}
                    >
                      Edit
                    </button>
                    <button className="button-secondary" type="button" onClick={() => void handleDelete(passenger)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PassengerFields({
  formState,
  onChange,
}: {
  formState: FormState;
  onChange: <Key extends keyof FormState>(key: Key, value: FormState[Key]) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>First name</span>
          <input value={formState.firstName} onChange={(event) => onChange("firstName", event.target.value)} required />
        </label>
        <label className="field">
          <span>Last name</span>
          <input value={formState.lastName} onChange={(event) => onChange("lastName", event.target.value)} required />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Legal name</span>
          <input value={formState.legalName} onChange={(event) => onChange("legalName", event.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={formState.email} onChange={(event) => onChange("email", event.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Phone</span>
          <input value={formState.phone} onChange={(event) => onChange("phone", event.target.value)} />
        </label>
        <label className="field">
          <span>Passenger type</span>
          <select value={formState.passengerType} onChange={(event) => onChange("passengerType", event.target.value)}>
            <option value="WEST_SANTO">West Santo</option>
            <option value="GUEST_SANTO">Guest Santo</option>
            <option value="HARIBHAKTO">Haribhakto</option>
            <option value="EXTRA_SEAT">Extra Seat</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Food / diet / notes</span>
        <textarea rows={4} value={formState.notes} onChange={(event) => onChange("notes", event.target.value)} />
      </label>
    </>
  );
}
