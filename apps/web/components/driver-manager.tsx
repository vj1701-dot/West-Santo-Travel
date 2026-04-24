"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AirportMultiSelect, type AirportChoice } from "./airport-autocomplete";

type AirportRecord = {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  country?: string | null;
};

type DriverRecord = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  telegramChatId: string | null;
  telegramUsername: string | null;
  airportIds: string[];
  airportCodes: string[];
};

type FormState = {
  name: string;
  phone: string;
  notes: string;
  airportIds: string[];
  chatId: string;
  telegramUsername: string;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  notes: "",
  airportIds: [],
  chatId: "",
  telegramUsername: "",
};

function toFormState(driver: DriverRecord): FormState {
  return {
    name: driver.name,
    phone: driver.phone ?? "",
    notes: driver.notes ?? "",
    airportIds: driver.airportIds,
    chatId: "",
    telegramUsername: driver.telegramUsername ?? "",
  };
}

export function DriverManager({ drivers, airports }: { drivers: DriverRecord[]; airports: AirportRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [panelMode, setPanelMode] = useState<"create" | "edit" | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);

  const airportChoices: AirportChoice[] = useMemo(
    () =>
      airports.map((airport) => ({
        id: airport.id,
        code: airport.code,
        name: airport.name,
        city: airport.city,
        country: airport.country,
      })),
    [airports],
  );

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return drivers;
    return drivers.filter((driver) =>
      [driver.name, driver.phone ?? "", driver.notes ?? "", driver.airportCodes.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [drivers, search]);

  const editingDriver =
    panelMode === "edit" && editingDriverId
      ? drivers.find((driver) => driver.id === editingDriverId) ?? null
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
    setEditingDriverId(null);
    setFormState(emptyForm);
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submitJson("/api/drivers", "POST", {
      name: formState.name,
      phone: formState.phone || null,
      notes: formState.notes || null,
      airportIds: formState.airportIds,
    });

    if (ok) {
      closePanel();
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDriver) return;

    await submitJson(`/api/drivers/${editingDriver.id}`, "PATCH", {
      name: formState.name,
      phone: formState.phone || null,
      notes: formState.notes || null,
      airportIds: formState.airportIds,
    });
  }

  async function handleTelegramLink() {
    if (!editingDriver) return;
    if (!formState.chatId.trim()) {
      setMessage("Enter a chat ID to link Telegram.");
      return;
    }

    await submitJson("/api/telegram-links", "POST", {
      entityType: "DRIVER",
      entityId: editingDriver.id,
      chatId: formState.chatId.trim(),
      telegramUsername: formState.telegramUsername.trim() || null,
    });
  }

  async function handleDelete(driver: DriverRecord) {
    if (!window.confirm(`Disable driver ${driver.name}?`)) {
      return;
    }

    const response = await fetch(`/api/drivers/${driver.id}`, { method: "DELETE" });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to disable driver.");
      return;
    }

    if (editingDriverId === driver.id) {
      closePanel();
    }
    setMessage("Driver disabled.");
    startTransition(() => router.refresh());
  }

  return (
    <section className="panel stack">
      {message ? (
        <div className="compact-card">
          <p>{message}</p>
        </div>
      ) : null}

      <div className="row-card__title" style={{ alignItems: "end" }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Search drivers</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone, or airport" />
        </label>
        <button
          type="button"
          onClick={() => {
            setPanelMode("create");
            setEditingDriverId(null);
            setFormState(emptyForm);
          }}
        >
          Add Driver
        </button>
      </div>

      {panelMode === "create" ? (
        <form className="compact-card stack" onSubmit={handleCreateSubmit}>
          <h3 style={{ margin: 0 }}>Add Driver</h3>
          <DriverFields airportChoices={airportChoices} formState={formState} onChange={updateField} />
          <div className="actions-row" style={{ marginTop: 0 }}>
            <button className="button-secondary" type="button" onClick={closePanel}>
              Cancel
            </button>
            <button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Create driver"}
            </button>
          </div>
        </form>
      ) : null}

      {panelMode === "edit" && editingDriver ? (
        <form className="compact-card stack" onSubmit={handleEditSubmit}>
          <div>
            <h3 style={{ margin: 0 }}>Edit {editingDriver.name}</h3>
            <p className="notes" style={{ marginTop: "0.35rem" }}>
              Airports: {editingDriver.airportCodes.join(", ") || "None"} · Telegram: {editingDriver.telegramChatId ?? "Not linked"}
            </p>
          </div>
          <DriverFields airportChoices={airportChoices} formState={formState} onChange={updateField} />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="field">
              <span>Telegram chat ID</span>
              <input
                placeholder={editingDriver.telegramChatId ?? "Enter chat ID"}
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
            <button className="button-secondary" type="button" onClick={closePanel}>
              Cancel
            </button>
            <button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Save driver"}
            </button>
          </div>
        </form>
      ) : null}

      <table className="data-table">
        <thead>
          <tr>
            <th>Driver</th>
            <th>Airports</th>
            <th>Telegram</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredDrivers.map((driver) => (
            <tr key={driver.id}>
              <td>
                <strong>{driver.name}</strong>
                <div className="muted-inline">{driver.phone ?? "No phone"}</div>
              </td>
              <td>{driver.airportCodes.join(", ") || "None"}</td>
              <td>{driver.telegramChatId ? "Linked" : "Pending"}</td>
              <td>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Open edit form for ${driver.name}?`)) {
                        return;
                      }
                      setPanelMode("edit");
                      setEditingDriverId(driver.id);
                      setFormState(toFormState(driver));
                    }}
                  >
                    Edit
                  </button>
                  <button className="button-secondary" type="button" onClick={() => void handleDelete(driver)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {filteredDrivers.length === 0 ? (
            <tr>
              <td colSpan={4}>No drivers found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function DriverFields({
  airportChoices,
  formState,
  onChange,
}: {
  airportChoices: AirportChoice[];
  formState: FormState;
  onChange: <Key extends keyof FormState>(key: Key, value: FormState[Key]) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Name</span>
          <input value={formState.name} onChange={(event) => onChange("name", event.target.value)} required />
        </label>
        <label className="field">
          <span>Phone</span>
          <input value={formState.phone} onChange={(event) => onChange("phone", event.target.value)} />
        </label>
      </div>
      <AirportMultiSelect
        airports={airportChoices}
        label="Assigned airports"
        name="airportIds"
        selectedIds={formState.airportIds}
        onChange={(airportIds) => onChange("airportIds", airportIds)}
      />
      <label className="field">
        <span>Notes</span>
        <textarea rows={4} value={formState.notes} onChange={(event) => onChange("notes", event.target.value)} />
      </label>
    </>
  );
}
