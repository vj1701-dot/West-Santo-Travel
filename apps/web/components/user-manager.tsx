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

type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  legalName: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  role: "ADMIN" | "COORDINATOR" | "PASSENGER";
  profileType: "WEST_SANTO" | "GUEST_SANTO" | "HARIBHAKTO" | null;
  excludeFromCoordinatorMessages: boolean;
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

type FormState = {
  firstName: string;
  lastName: string;
  legalName: string;
  email: string;
  phone: string;
  notes: string;
  role: "ADMIN" | "COORDINATOR" | "PASSENGER";
  profileType: "" | "WEST_SANTO" | "GUEST_SANTO" | "HARIBHAKTO";
  excludeFromCoordinatorMessages: boolean;
  airportIds: string[];
  isActive: boolean;
  chatId: string;
  telegramUsername: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  legalName: "",
  email: "",
  phone: "",
  notes: "",
  role: "COORDINATOR",
  profileType: "",
  excludeFromCoordinatorMessages: false,
  airportIds: [],
  isActive: true,
  chatId: "",
  telegramUsername: "",
};

function toFormState(user: UserRecord): FormState {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    legalName: user.legalName ?? "",
    email: user.email,
    phone: user.phone ?? "",
    notes: user.notes ?? "",
    role: user.role,
    profileType: user.profileType ?? "",
    excludeFromCoordinatorMessages: user.excludeFromCoordinatorMessages,
    airportIds: user.airportIds,
    isActive: user.isActive,
    chatId: "",
    telegramUsername: user.telegramUsername ?? "",
  };
}

export function UserManager({ users, airports }: { users: UserRecord[]; airports: AirportRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [panelMode, setPanelMode] = useState<"create" | "edit" | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
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

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.firstName, user.lastName, user.legalName ?? "", user.email, user.phone ?? "", user.notes ?? "", user.role, user.profileType ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [users, search]);

  const editingUser =
    panelMode === "edit" && editingUserId ? users.find((user) => user.id === editingUserId) ?? null : null;

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
    setEditingUserId(null);
    setFormState(emptyForm);
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submitJson("/api/users", "POST", {
      firstName: formState.firstName,
      lastName: formState.lastName,
      legalName: formState.legalName || null,
      email: formState.email,
      phone: formState.phone || null,
      notes: formState.notes || null,
      role: formState.role,
      profileType: formState.profileType || null,
      excludeFromCoordinatorMessages: formState.excludeFromCoordinatorMessages,
      airportIds: formState.airportIds,
    });

    if (ok) {
      closePanel();
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;

    await submitJson(`/api/users/${editingUser.id}`, "PATCH", {
      firstName: formState.firstName,
      lastName: formState.lastName,
      legalName: formState.legalName || null,
      email: formState.email,
      phone: formState.phone || null,
      notes: formState.notes || null,
      role: formState.role,
      profileType: formState.profileType || null,
      excludeFromCoordinatorMessages: formState.excludeFromCoordinatorMessages,
      airportIds: formState.airportIds,
      isActive: formState.isActive,
    });
  }

  async function handleTelegramLink() {
    if (!editingUser) return;
    if (!formState.chatId.trim()) {
      setMessage("Enter a chat ID to link Telegram.");
      return;
    }

    await submitJson("/api/telegram-links", "POST", {
      entityType: "USER",
      entityId: editingUser.id,
      chatId: formState.chatId.trim(),
      telegramUsername: formState.telegramUsername.trim() || null,
    });
  }

  async function handleDelete(user: UserRecord) {
    if (!window.confirm(`Disable user ${user.firstName} ${user.lastName}?`)) {
      return;
    }

    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to disable user.");
      return;
    }

    if (editingUserId === user.id) {
      closePanel();
    }
    setMessage("User disabled.");
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
          <span>Search users</span>
          <input
            placeholder="Search by name, email, phone, or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setPanelMode("create");
            setEditingUserId(null);
            setFormState(emptyForm);
          }}
        >
          Add User
        </button>
      </div>

      {panelMode === "create" ? (
        <form className="compact-card stack" onSubmit={handleCreateSubmit}>
          <div className="row-card__title">
            <h3 style={{ margin: 0 }}>Add User</h3>
            <button className="button-secondary" type="button" onClick={closePanel}>
              Cancel
            </button>
          </div>
          <UserFields airportChoices={airportChoices} formState={formState} onChange={updateField} includeActive={false} />
          <div className="actions-row" style={{ marginTop: 0 }}>
            <button disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Create user"}
            </button>
          </div>
        </form>
      ) : null}

      {panelMode === "edit" && editingUser ? (
        <form className="compact-card stack" onSubmit={handleEditSubmit}>
          <div className="row-card__title">
            <div>
              <h3 style={{ margin: 0 }}>
                Edit {editingUser.firstName} {editingUser.lastName}
              </h3>
              <p className="notes" style={{ marginTop: "0.35rem" }}>
                Identity: {editingUser.identityLinkedAt ? editingUser.identityProvider ?? "Linked" : "Pending first login"} · Passenger link:{" "}
                {editingUser.linkedPassengerName ?? "Not linked"}
              </p>
            </div>
            <button className="button-secondary" type="button" onClick={closePanel}>
              Cancel
            </button>
          </div>
          <UserFields airportChoices={airportChoices} formState={formState} onChange={updateField} includeActive />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="field">
              <span>Telegram chat ID</span>
              <input
                placeholder={editingUser.telegramChatId ?? "Enter chat ID"}
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
              {isPending ? "Saving..." : "Save user"}
            </button>
          </div>
        </form>
      ) : null}

      <table className="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Type</th>
            <th>Messages</th>
            <th>Airports</th>
            <th>Identity</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user.id}>
              <td>
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <div className="muted-inline">{user.phone ?? user.email ?? user.legalName ?? "No contact"}</div>
              </td>
              <td>{user.role}</td>
              <td>{user.profileType ? user.profileType.replace(/_/g, " ") : "Not set"}</td>
              <td>{user.role === "COORDINATOR" && user.excludeFromCoordinatorMessages ? "Excluded" : "Active"}</td>
              <td>{user.airportCodes.join(", ") || "None"}</td>
              <td>{user.identityLinkedAt ? user.identityProvider ?? "Linked" : "Pending first login"}</td>
              <td>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Open edit form for ${user.firstName} ${user.lastName}?`)) {
                        return;
                      }
                      setPanelMode("edit");
                      setEditingUserId(user.id);
                      setFormState(toFormState(user));
                    }}
                  >
                    Edit
                  </button>
                  <button className="button-secondary" type="button" onClick={() => void handleDelete(user)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {filteredUsers.length === 0 ? (
            <tr>
              <td colSpan={7}>No users found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function UserFields({
  airportChoices,
  formState,
  onChange,
  includeActive,
}: {
  airportChoices: AirportChoice[];
  formState: FormState;
  onChange: <Key extends keyof FormState>(key: Key, value: FormState[Key]) => void;
  includeActive: boolean;
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
          <span>Email used for login</span>
          <input type="email" value={formState.email} onChange={(event) => onChange("email", event.target.value)} required />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Phone</span>
          <input value={formState.phone} onChange={(event) => onChange("phone", event.target.value)} />
        </label>
        <label className="field">
          <span>Role</span>
          <select value={formState.role} onChange={(event) => onChange("role", event.target.value as FormState["role"])}>
            <option value="ADMIN">Admin</option>
            <option value="COORDINATOR">Coordinator</option>
            <option value="PASSENGER">Passenger</option>
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select value={formState.profileType} onChange={(event) => onChange("profileType", event.target.value as FormState["profileType"])}>
            <option value="">Not set</option>
            <option value="WEST_SANTO">West Santo</option>
            <option value="GUEST_SANTO">Guest Santo</option>
            <option value="HARIBHAKTO">Haribhakt</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Food / diet / notes</span>
        <textarea rows={4} value={formState.notes} onChange={(event) => onChange("notes", event.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {includeActive ? (
          <label className="checkbox" style={{ alignSelf: "end" }}>
            <input
              checked={formState.isActive}
              onChange={(event) => onChange("isActive", event.target.checked)}
              type="checkbox"
            />{" "}
            Active
          </label>
        ) : null}
      </div>
      {formState.role === "COORDINATOR" ? (
        <label className="checkbox">
          <input
            checked={formState.excludeFromCoordinatorMessages}
            onChange={(event) => onChange("excludeFromCoordinatorMessages", event.target.checked)}
            type="checkbox"
          />{" "}
          Exclude from messages
        </label>
      ) : null}
      <AirportMultiSelect
        airports={airportChoices}
        label="Assigned airports"
        name="airportIds"
        selectedIds={formState.airportIds}
        onChange={(airportIds) => onChange("airportIds", airportIds)}
      />
    </>
  );
}
