"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

export function ReminderRuleManager({ rules }: { rules: ReminderRuleRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

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

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Reminder Rules</p>
          <h2>No-code reminder logic for Telegram and internal alerts</h2>
        </div>
      </div>
      {message ? <div className="compact-card"><p>{message}</p></div> : null}
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
                <option value="INTERNAL">Internal</option>
              </select>
            </label>
            <label className="field"><span>Offset minutes</span><input defaultValue={-1440} name="offsetMinutes" type="number" /></label>
            <label className="field"><span>Template</span><textarea name="template" rows={5} placeholder="Hi {{passenger_name}}, your flight {{flight_number}} departs soon." /></label>
            <button disabled={isPending} type="submit">Create rule</button>
          </form>

          {rules.map((rule) => (
            <article key={rule.id} className="compact-card stack">
              <div className="row-card__title">
                <div>
                  <h3>{rule.name}</h3>
                  <p>{rule.lastRunAt ? `Last run ${new Date(rule.lastRunAt).toLocaleString()}` : "Not run yet"}</p>
                </div>
                <span className="pill">{rule.isActive ? "Active" : "Paused"}</span>
              </div>
              {rule.lastError ? <p className="notes">{rule.lastError}</p> : null}
              <button
                className="button-secondary"
                disabled={isPending}
                onClick={() => void submitJson(`/api/reminder-rules/${rule.id}`, "PATCH", { isActive: !rule.isActive })}
                type="button"
              >
                {rule.isActive ? "Pause rule" : "Enable rule"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
