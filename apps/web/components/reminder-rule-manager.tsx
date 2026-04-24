"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type ReminderRuleRecord = {
  id: string;
  name: string;
  isActive: boolean;
  trigger: string;
  audience: string;
  channel: string;
  offsetMinutes: number;
  template: string;
  lastRunAt: string | null;
  lastError: string | null;
};

type WorkflowRecord = {
  id: string;
  name: string;
  audience: string;
  channel: string;
  schedule: string;
};

type UpcomingFlight = {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeLocal: string;
  departureTimeZone: string;
  passengerCount: number;
};

type EditableRule = ReminderRuleRecord & {
  isDirty?: boolean;
};

export function ReminderRuleManager({
  rules,
  workflows,
  upcomingFlights: initialFlights,
}: {
  rules: ReminderRuleRecord[];
  workflows: readonly WorkflowRecord[];
  upcomingFlights: UpcomingFlight[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [editableRules, setEditableRules] = useState<EditableRule[]>(rules);

  const [upcomingFlights, setUpcomingFlights] = useState(initialFlights);
  const [isRefreshingFlights, setIsRefreshingFlights] = useState(false);
  const [flightsLoadError, setFlightsLoadError] = useState<string | null>(null);

  const [sendFlightId, setSendFlightId] = useState("");
  const [sendChannel, setSendChannel] = useState<"TELEGRAM" | "SMS" | "TELEGRAM_SMS">("TELEGRAM");
  const [sendMessage, setSendMessage] = useState("");
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setEditableRules(rules);
  }, [rules]);

  // Refresh flights when component mounts or every 30 seconds
  useEffect(() => {
    const refreshFlights = async () => {
      try {
        setFlightsLoadError(null);
        const res = await fetch("/api/flights/upcoming");
        if (res.ok) {
          const data = await res.json();
          const flights = Array.isArray(data.data) ? data.data : [];
          setUpcomingFlights(flights);
          console.log(`Loaded ${flights.length} upcoming flights`);
        } else {
          const error = await res.text();
          console.error("API error:", res.status, error);
          setFlightsLoadError(`API error: ${res.status}`);
        }
      } catch (error) {
        console.error("Failed to refresh flights:", error);
        setFlightsLoadError(error instanceof Error ? error.message : "Network error");
      }
    };

    refreshFlights();
    const interval = setInterval(refreshFlights, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function refreshFlightsNow() {
    setIsRefreshingFlights(true);
    setFlightsLoadError(null);
    try {
      const res = await fetch("/api/flights/upcoming");
      if (res.ok) {
        const data = await res.json();
        const flights = Array.isArray(data.data) ? data.data : [];
        setUpcomingFlights(flights);
        setSendStatus({ ok: true, text: `Flight list updated. Found ${flights.length} flights.` });
        console.log(`Refreshed: Found ${flights.length} upcoming flights`);
      } else {
        const error = await res.text();
        console.error("API error:", res.status, error);
        setSendStatus({ ok: false, text: `Failed to refresh flight list (${res.status})` });
        setFlightsLoadError(`API error: ${res.status}`);
      }
    } catch (error) {
      console.error("Network error:", error);
      setSendStatus({ ok: false, text: "Network error while refreshing flights." });
      setFlightsLoadError(error instanceof Error ? error.message : "Network error");
    } finally {
      setIsRefreshingFlights(false);
    }
  }

  async function sendNow() {
    if (!sendFlightId) return;
    setIsSending(true);
    setSendStatus(null);
    try {
      const res = await fetch("/api/reminders/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightSegmentId: sendFlightId,
          channel: sendChannel,
          message: sendMessage.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const count: number = data.data?.queued ?? 0;
        setSendStatus({ ok: true, text: `${count} notification${count !== 1 ? "s" : ""} queued.` });
        setSendMessage("");
      } else {
        setSendStatus({ ok: false, text: data.error?.message ?? "Failed to queue reminders." });
      }
    } catch {
      setSendStatus({ ok: false, text: "Network error. Please try again." });
    } finally {
      setIsSending(false);
    }
  }

  async function submitJson(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error?.message ?? "Request failed.");
      return false;
    }

    setMessage("Saved.");
    startTransition(() => router.refresh());
    return true;
  }

  async function saveRule(rule: EditableRule) {
    const ok = await submitJson(`/api/reminder-rules/${rule.id}`, "PATCH", {
      name: rule.name,
      isActive: rule.isActive,
      trigger: rule.trigger,
      audience: rule.audience,
      channel: rule.channel,
      offsetMinutes: rule.offsetMinutes,
      template: rule.template,
    });

    if (ok) {
      setEditableRules((current) =>
        current.map((item) => (item.id === rule.id ? { ...rule, isDirty: false } : item)),
      );
    }
  }

  async function deleteRule(ruleId: string) {
    const response = await fetch(`/api/reminder-rules/${ruleId}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error?.message ?? "Delete failed.");
      return;
    }

    setMessage("Rule deleted.");
    startTransition(() => router.refresh());
  }

  function updateRule(ruleId: string, nextValue: Partial<EditableRule>) {
    setEditableRules((current) =>
      current.map((rule) => (rule.id === ruleId ? { ...rule, ...nextValue, isDirty: true } : rule)),
    );
  }

  function formatFlightLabel(f: UpcomingFlight) {
    const d = new Date(f.departureTimeLocal);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const month = months[d.getUTCMonth()];
    const day = d.getUTCDate();
    const h = d.getUTCHours();
    const min = d.getUTCMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const label = `${month} ${day}, ${h12}:${min} ${ampm}`;
    const pax = f.passengerCount === 1 ? "1 pax" : `${f.passengerCount} pax`;
    return `${f.flightNumber} · ${f.departureAirport} → ${f.arrivalAirport} · ${label} · ${pax}`;
  }

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Reminder Rules</p>
          <h2>Built-in notification workflows plus advanced rules</h2>
        </div>
      </div>
      {message ? <div className="compact-card"><p>{message}</p></div> : null}
      <div className="table-panel">
        <h3 style={{ marginBottom: "1rem" }}>Built-in workflows</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Audience</th>
              <th>Channel</th>
              <th>Schedule</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((workflow) => (
              <tr key={workflow.id}>
                <td>{workflow.name}</td>
                <td>{workflow.audience}</td>
                <td>{workflow.channel}</td>
                <td>{workflow.schedule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-panel stack" style={{ gap: "1rem" }}>
        <h3>Send flight reminder now</h3>
        <p style={{ color: "var(--color-muted, #6b7280)", fontSize: "0.875rem" }}>
          Select an upcoming flight and send an immediate reminder to all passengers via your chosen channel.
        </p>
        <label className="field">
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              Flight
              {upcomingFlights.length > 0 && (
                <span style={{ marginLeft: "0.5rem", fontSize: "0.875rem", color: "var(--color-muted, #6b7280)" }}>
                  ({upcomingFlights.length})
                </span>
              )}
            </span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void refreshFlightsNow()}
              disabled={isRefreshingFlights}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
            >
              {isRefreshingFlights ? "Refreshing…" : "Refresh"}
            </button>
          </span>
          {flightsLoadError && (
            <div style={{ color: "var(--color-danger, #dc2626)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              ⚠️ Error loading flights: {flightsLoadError}
            </div>
          )}
          <select value={sendFlightId} onChange={(e) => { setSendFlightId(e.target.value); setSendStatus(null); }}>
            <option value="">— {upcomingFlights.length === 0 ? "No flights available" : "select a flight"} —</option>
            {upcomingFlights.map((f) => (
              <option key={f.id} value={f.id}>{formatFlightLabel(f)}</option>
            ))}
          </select>
        </label>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>Channel</legend>
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
            {(["TELEGRAM", "SMS", "TELEGRAM_SMS"] as const).map((ch) => (
              <label key={ch} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.9rem" }}>
                <input
                  type="radio"
                  name="sendChannel"
                  value={ch}
                  checked={sendChannel === ch}
                  onChange={() => setSendChannel(ch)}
                />
                {ch === "TELEGRAM" ? "Telegram" : ch === "SMS" ? "SMS" : "SMS + Telegram"}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Custom message <span style={{ fontWeight: 400, color: "var(--color-muted, #6b7280)" }}>(optional — leave blank for auto-generated summary)</span></span>
          <textarea
            rows={3}
            value={sendMessage}
            onChange={(e) => setSendMessage(e.target.value)}
            placeholder="e.g. Reminder: your flight departs soon. Please check in."
          />
        </label>
        {sendStatus ? (
          <p style={{ color: sendStatus.ok ? "var(--color-success, #16a34a)" : "var(--color-danger, #dc2626)", fontSize: "0.875rem" }}>
            {sendStatus.text}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            disabled={!sendFlightId || isSending}
            onClick={() => void sendNow()}
          >
            {isSending ? "Sending…" : "Send reminder"}
          </button>
        </div>
      </div>

      <div className="manager-layout">
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Audience</th>
                <th>Offset</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.trigger}</td>
                  <td>{rule.audience}</td>
                  <td>{rule.offsetMinutes} min</td>
                  <td>{rule.isActive ? "Active" : "Paused"}</td>
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
              const ok = await submitJson("/api/reminder-rules", "POST", {
                name: form.get("name"),
                trigger: form.get("trigger"),
                audience: form.get("audience"),
                channel: form.get("channel"),
                offsetMinutes: Number(form.get("offsetMinutes")),
                template: form.get("template"),
              });
              if (ok) event.currentTarget.reset();
            }}
          >
            <h3>Create rule</h3>
            <label className="field"><span>Name</span><input name="name" required /></label>
            <label className="field">
              <span>Trigger</span>
              <select defaultValue="FLIGHT_DEPARTURE" name="trigger">
                <option value="FLIGHT_DEPARTURE">Before flight departure</option>
                <option value="BOOKING_CREATED">After booking created</option>
                <option value="PICKUP_SCHEDULED">Before pickup</option>
                <option value="TRANSPORT_STATUS_CHANGED">Transport status changed</option>
              </select>
            </label>
            <label className="field">
              <span>Audience</span>
              <select defaultValue="PASSENGER" name="audience">
                <option value="PASSENGER">Passenger</option>
                <option value="DRIVER">Driver</option>
                <option value="COORDINATOR">Coordinator</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label className="field">
              <span>Channel</span>
                  <select defaultValue="TELEGRAM" name="channel">
                    <option value="TELEGRAM">Telegram</option>
                    <option value="SMS">SMS</option>
                    <option value="INTERNAL">Internal</option>
                  </select>
                </label>
            <label className="field"><span>Offset minutes</span><input defaultValue={-1440} name="offsetMinutes" type="number" /></label>
            <label className="field"><span>Template</span><textarea name="template" rows={5} placeholder="Hi {{passenger_name}}, your flight {{flight_number}} departs soon." /></label>
            <button disabled={isPending} type="submit">Create rule</button>
          </form>

          {editableRules.map((rule) => (
            <article key={rule.id} className="compact-card stack reminder-rule-card">
              <div className="row-card__title">
                <div>
                  <h3>{rule.name}</h3>
                  <p>{rule.lastRunAt ? `Last run ${new Date(rule.lastRunAt).toLocaleString()}` : "Not run yet"}</p>
                </div>
                <span className="pill">{rule.isActive ? "Active" : "Paused"}</span>
              </div>
              {rule.lastError ? <p className="notes">{rule.lastError}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">
                  <span>Name</span>
                  <input value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} />
                </label>
                <label className="field">
                  <span>Offset minutes</span>
                  <input
                    type="number"
                    value={rule.offsetMinutes}
                    onChange={(event) => updateRule(rule.id, { offsetMinutes: Number(event.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Trigger</span>
                  <select value={rule.trigger} onChange={(event) => updateRule(rule.id, { trigger: event.target.value })}>
                    <option value="FLIGHT_DEPARTURE">Before flight departure</option>
                    <option value="BOOKING_CREATED">After booking created</option>
                    <option value="PICKUP_SCHEDULED">Before pickup</option>
                    <option value="TRANSPORT_STATUS_CHANGED">Transport status changed</option>
                  </select>
                </label>
                <label className="field">
                  <span>Audience</span>
                  <select value={rule.audience} onChange={(event) => updateRule(rule.id, { audience: event.target.value })}>
                    <option value="PASSENGER">Passenger</option>
                    <option value="DRIVER">Driver</option>
                    <option value="COORDINATOR">Coordinator</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <label className="field">
                  <span>Channel</span>
                  <select value={rule.channel} onChange={(event) => updateRule(rule.id, { channel: event.target.value })}>
                    <option value="TELEGRAM">Telegram</option>
                    <option value="SMS">SMS</option>
                    <option value="INTERNAL">Internal</option>
                  </select>
                </label>
                <label className="field reminder-rule-card__toggle">
                  <span>Status</span>
                  <button
                    className="button-secondary"
                    disabled={isPending}
                    onClick={() => updateRule(rule.id, { isActive: !rule.isActive })}
                    type="button"
                  >
                    {rule.isActive ? "Pause rule" : "Enable rule"}
                  </button>
                </label>
              </div>
              <label className="field">
                <span>Template</span>
                <textarea value={rule.template} rows={4} onChange={(event) => updateRule(rule.id, { template: event.target.value })} />
              </label>
              <div className="actions-row">
                <button
                  className="button-secondary"
                  disabled={isPending || !rule.isDirty}
                  onClick={() => void saveRule(rule)}
                  type="button"
                >
                  Save changes
                </button>
                <button
                  className="admin-form__reject"
                  disabled={isPending}
                  onClick={() => void deleteRule(rule.id)}
                  type="button"
                >
                  Delete rule
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
