"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type DriverOption = {
  id: string;
  name: string;
  airportCodes: string[];
};

type TaskRecord = {
  id: string;
  taskType: string;
  status: string;
  notes: string | null;
  scheduledTimeLocal: Date | null;
  airport: { id: string; code: string; name: string };
  mandir: { name: string } | null;
  itinerary: {
    itineraryPassengers: Array<{
      passenger: { firstName: string; lastName: string };
    }>;
  };
  flightSegment: {
    flightNumber: string;
    departureAirport: { code: string };
    arrivalAirport: { code: string };
  } | null;
  drivers: Array<{
    driver: {
      id: string;
      name: string;
    };
  }>;
};

function formatDateTime(value: Date | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TransportTaskBoard({ tasks, drivers }: { tasks: TaskRecord[]; drivers: DriverOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const visibleTasks = useMemo(() => {
    if (statusFilter === "ALL") return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [tasks, statusFilter]);

  async function submitJson(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
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
          <p className="eyebrow">Dispatch</p>
          <h2>Active pickup and drop-off board</h2>
        </div>
        <label className="field transport-filter">
          <span>Status filter</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="EN_ROUTE">En route</option>
            <option value="PICKED_UP">Picked up</option>
            <option value="DROPPED_OFF">Dropped off</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
      </div>

      {message ? <div className="compact-card"><p>{message}</p></div> : null}

      <div className="stack">
        {visibleTasks.map((task) => (
          <article key={task.id} className="trip-card">
            <div className="row-card__title">
              <div className="stack--tight">
                <h3>
                  {task.taskType} · {task.airport.code} · {task.flightSegment?.flightNumber ?? "No segment"}
                </h3>
                <div className="row-meta">
                  <span>{task.flightSegment ? `${task.flightSegment.departureAirport.code} -> ${task.flightSegment.arrivalAirport.code}` : "No route"}</span>
                  <span>{formatDateTime(task.scheduledTimeLocal)}</span>
                  <span>{task.itinerary.itineraryPassengers.length} passengers</span>
                </div>
              </div>
              <span className="pill">{task.status}</span>
            </div>

            <div className="detail-grid">
              <div className="detail-section">
                <p className="eyebrow">Travelers</p>
                <ul className="detail-list">
                  {task.itinerary.itineraryPassengers.map((entry) => (
                    <li key={`${task.id}-${entry.passenger.firstName}-${entry.passenger.lastName}`}>
                      <strong>{entry.passenger.firstName} {entry.passenger.lastName}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="detail-section">
                <p className="eyebrow">Assignment</p>
                <ul className="detail-list">
                  <li>
                    <strong>Mandir</strong>
                    <span>{task.mandir?.name ?? "No mandir"}</span>
                  </li>
                  <li>
                    <strong>Drivers</strong>
                    <span>{task.drivers.map((entry) => entry.driver.name).join(", ") || "Unassigned"}</span>
                  </li>
                  {task.notes ? (
                    <li>
                      <strong>Notes</strong>
                      <span>{task.notes}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>

            <form
              className="task-actions"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const selectedDriverIds = form.getAll("driverIds").map(String).filter(Boolean);
                await submitJson(`/api/transport-tasks/${task.id}/assign`, {
                  driverIds: selectedDriverIds,
                });
              }}
            >
              <label className="field">
                <span>Assign drivers</span>
                <select defaultValue={task.drivers.map((entry) => entry.driver.id)} multiple name="driverIds" size={Math.max(3, Math.min(6, drivers.length))}>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} {driver.airportCodes.length > 0 ? `· ${driver.airportCodes.join(", ")}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="task-status-row">
                {["UNASSIGNED", "ASSIGNED", "EN_ROUTE", "PICKED_UP", "DROPPED_OFF", "COMPLETED", "CANCELLED"].map((status) => (
                  <button
                    key={status}
                    className={status === task.status ? "button-secondary" : undefined}
                    disabled={isPending}
                    type="button"
                    onClick={() => {
                      void submitJson(`/api/transport-tasks/${task.id}/status`, { status });
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <button disabled={isPending} type="submit">Save driver assignment</button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
