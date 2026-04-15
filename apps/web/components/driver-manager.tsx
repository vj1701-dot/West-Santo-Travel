"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

export function DriverManager({ drivers, airports }: { drivers: DriverRecord[]; airports: AirportRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(drivers[0]?.id ?? null);
  const [createAirportResetKey, setCreateAirportResetKey] = useState(0);
  const selectedDriver = drivers.find((driver) => driver.id === selectedId) ?? null;
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
      [driver.name, driver.phone ?? "", driver.notes ?? "", driver.airportCodes.join(" ")].join(" ").toLowerCase().includes(query),
    );
  }, [drivers, search]);

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

  function readAirportIds(form: FormData) {
    return form.getAll("airportIds").map(String).filter(Boolean);
  }

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Drivers</p>
          <h2>Airport assignment and transport coverage</h2>
        </div>
      </div>
      {message ? <div className="compact-card"><p>{message}</p></div> : null}

      <div className="manager-layout manager-layout--balanced">
        <div className="table-panel stack">
          <div className="manager-summary">
            <div className="info-tile">
              <span>Total drivers</span>
              <strong>{drivers.length}</strong>
            </div>
            <div className="info-tile">
              <span>Telegram linked</span>
              <strong>{drivers.filter((driver) => driver.telegramChatId).length}</strong>
            </div>
            <div className="info-tile">
              <span>Airport coverage</span>
              <strong>{new Set(drivers.flatMap((driver) => driver.airportIds)).size}</strong>
            </div>
          </div>
          <label className="field">
            <span>Search drivers</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Airports</th>
                <th>Telegram</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((driver) => (
                <tr
                  key={driver.id}
                  className={selectedId === driver.id ? "data-table__row--active" : ""}
                  onClick={() => setSelectedId(driver.id)}
                >
                  <td>
                    <strong>{driver.name}</strong>
                    <div className="muted-inline">{driver.phone ?? "No phone"}</div>
                  </td>
                  <td>{driver.airportCodes.join(", ") || "None"}</td>
                  <td>{driver.telegramChatId ? "Linked" : "Pending"}</td>
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
              const ok = await submitJson("/api/drivers", "POST", {
                name: form.get("name"),
                phone: form.get("phone") || null,
                notes: form.get("notes") || null,
                airportIds: readAirportIds(form),
              });
              if (ok) {
                event.currentTarget.reset();
                setCreateAirportResetKey((current) => current + 1);
              }
            }}
          >
            <div className="manager-inspector-header">
              <div>
                <p className="eyebrow">New Driver</p>
                <h3>Add driver</h3>
              </div>
              <p className="muted-inline">Create a transport contact and assign their airport coverage.</p>
            </div>
            <label className="field"><span>Name</span><input name="name" required /></label>
            <label className="field"><span>Phone</span><input name="phone" /></label>
            <AirportMultiSelect airports={airportChoices} key={createAirportResetKey} label="Assigned airports" name="airportIds" />
            <label className="field"><span>Notes</span><textarea name="notes" rows={4} /></label>
            <button disabled={isPending} type="submit">Create driver</button>
          </form>

          {selectedDriver ? (
            <form
              key={selectedDriver.id}
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                await submitJson(`/api/drivers/${selectedDriver.id}`, "PATCH", {
                  name: form.get("name"),
                  phone: form.get("phone") || null,
                  notes: form.get("notes") || null,
                  airportIds: readAirportIds(form),
                });
              }}
            >
              <div className="manager-inspector-header">
                <div>
                  <p className="eyebrow">Selected Driver</p>
                  <h3>{selectedDriver.name}</h3>
                </div>
                <p className="muted-inline">
                  {selectedDriver.airportCodes.length > 0 ? `${selectedDriver.airportCodes.length} airport assignments` : "No airport assignments"}
                </p>
              </div>
              <div className="info-grid">
                <Info label="Assigned airports" value={selectedDriver.airportCodes.join(", ") || "None"} />
                <Info label="Telegram" value={selectedDriver.telegramChatId ?? "Not linked"} />
              </div>
              <label className="field"><span>Name</span><input defaultValue={selectedDriver.name} name="name" required /></label>
              <label className="field"><span>Phone</span><input defaultValue={selectedDriver.phone ?? ""} name="phone" /></label>
              <AirportMultiSelect airports={airportChoices} label="Assigned airports" name="airportIds" selectedIds={selectedDriver.airportIds} />
              <label className="field"><span>Notes</span><textarea defaultValue={selectedDriver.notes ?? ""} name="notes" rows={4} /></label>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="field"><span>Telegram chat ID</span><input name="chatId" placeholder={selectedDriver.telegramChatId ?? "Enter chat ID"} /></label>
                <label className="field"><span>Telegram username</span><input defaultValue={selectedDriver.telegramUsername ?? ""} name="telegramUsername" /></label>
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
                      entityType: "DRIVER",
                      entityId: selectedDriver.id,
                      chatId,
                      telegramUsername: String(form.get("telegramUsername") ?? "").trim() || null,
                    });
                  }}
                >
                  Link Telegram
                </button>
              </div>
              <button disabled={isPending} type="submit">Save driver</button>
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
