"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type AirportRecord = {
  id: string;
  code: string;
  name: string;
};

type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "COORDINATOR" | "PASSENGER";
  isActive: boolean;
  telegramChatId: string | null;
  telegramUsername: string | null;
  airportIds: string[];
  airportCodes: string[];
  identityProvider?: string | null;
  identityLinkedAt?: string | null;
  lastLoginAt?: string | null;
  linkedPassengerName?: string | null;
};

export function UserManager({ users, airports }: { users: UserRecord[]; airports: AirportRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(users[0]?.id ?? null);
  const selectedUser = users.find((user) => user.id === selectedId) ?? null;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.firstName, user.lastName, user.email, user.phone ?? "", user.role].join(" ").toLowerCase().includes(query),
    );
  }, [users, search]);

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

  const readAirportIds = (form: FormData) => form.getAll("airportIds").map(String).filter(Boolean);

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Users</p>
          <h2>Provision app access by email</h2>
        </div>
      </div>
      {message ? <div className="compact-card"><p>{message}</p></div> : null}

      <div className="manager-layout">
        <div className="table-panel stack">
          <label className="field">
            <span>Search users</span>
            <input placeholder="Search by name, email, phone, or role" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>

          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Airports</th>
                <th>Identity</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={selectedId === user.id ? "data-table__row--active" : ""}
                  onClick={() => setSelectedId(user.id)}
                >
                  <td>
                    <strong>{user.firstName} {user.lastName}</strong>
                    <div className="muted-inline">{user.email}</div>
                  </td>
                  <td>{user.role}</td>
                  <td>{user.airportCodes.join(", ") || "None"}</td>
                  <td>{user.identityLinkedAt ? user.identityProvider ?? "Linked" : "Pending first login"}</td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
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
              const ok = await submitJson("/api/users", "POST", {
                firstName: form.get("firstName"),
                lastName: form.get("lastName"),
                email: form.get("email"),
                phone: form.get("phone") || null,
                role: form.get("role"),
                airportIds: readAirportIds(form),
              });
              if (ok) event.currentTarget.reset();
            }}
          >
            <h3>Grant access</h3>
            <label className="field"><span>First name</span><input name="firstName" required /></label>
            <label className="field"><span>Last name</span><input name="lastName" required /></label>
            <label className="field"><span>Email used for Google login</span><input name="email" required type="email" /></label>
            <label className="field"><span>Phone</span><input name="phone" /></label>
            <label className="field">
              <span>Role</span>
              <select defaultValue="COORDINATOR" name="role">
                <option value="ADMIN">Admin</option>
                <option value="COORDINATOR">Coordinator</option>
                <option value="PASSENGER">Passenger</option>
              </select>
            </label>
            <label className="field">
              <span>Assigned airports</span>
              <select multiple name="airportIds" size={Math.max(3, Math.min(6, airports.length))}>
                {airports.map((airport) => (
                  <option key={airport.id} value={airport.id}>{airport.code} - {airport.name}</option>
                ))}
              </select>
            </label>
            <button disabled={isPending} type="submit">Create user</button>
          </form>

          {selectedUser ? (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                await submitJson(`/api/users/${selectedUser.id}`, "PATCH", {
                  firstName: form.get("firstName"),
                  lastName: form.get("lastName"),
                  email: form.get("email"),
                  phone: form.get("phone") || null,
                  role: form.get("role"),
                  airportIds: readAirportIds(form),
                  isActive: form.get("isActive") === "on",
                });
              }}
            >
              <h3>User details</h3>
              <div className="info-grid">
                <Info label="Identity status" value={selectedUser.identityLinkedAt ? "Linked" : "Pending first Google login"} />
                <Info label="Last login" value={selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "Never"} />
                <Info label="Passenger link" value={selectedUser.linkedPassengerName ?? "Not linked"} />
                <Info label="Telegram" value={selectedUser.telegramChatId ?? "Not linked"} />
              </div>
              <label className="field"><span>First name</span><input defaultValue={selectedUser.firstName} name="firstName" required /></label>
              <label className="field"><span>Last name</span><input defaultValue={selectedUser.lastName} name="lastName" required /></label>
              <label className="field"><span>Email</span><input defaultValue={selectedUser.email} name="email" required type="email" /></label>
              <label className="field"><span>Phone</span><input defaultValue={selectedUser.phone ?? ""} name="phone" /></label>
              <label className="field">
                <span>Role</span>
                <select defaultValue={selectedUser.role} name="role">
                  <option value="ADMIN">Admin</option>
                  <option value="COORDINATOR">Coordinator</option>
                  <option value="PASSENGER">Passenger</option>
                </select>
              </label>
              <label className="field">
                <span>Assigned airports</span>
                <select defaultValue={selectedUser.airportIds} multiple name="airportIds" size={Math.max(3, Math.min(6, airports.length))}>
                  {airports.map((airport) => (
                    <option key={airport.id} value={airport.id}>{airport.code} - {airport.name}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox"><input defaultChecked={selectedUser.isActive} name="isActive" type="checkbox" /> Active</label>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="field"><span>Telegram chat ID</span><input name="chatId" placeholder={selectedUser.telegramChatId ?? "Enter chat ID"} /></label>
                <label className="field"><span>Telegram username</span><input defaultValue={selectedUser.telegramUsername ?? ""} name="telegramUsername" /></label>
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
                      entityType: "USER",
                      entityId: selectedUser.id,
                      chatId,
                      telegramUsername: String(form.get("telegramUsername") ?? "").trim() || null,
                    });
                  }}
                >
                  Link Telegram
                </button>
              </div>
              <button disabled={isPending} type="submit">Save user</button>
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
