"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "COORDINATOR" | "PASSENGER";
  isActive: boolean;
};

type PassengerRecord = {
  id: string;
  firstName: string;
  lastName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  passengerType: "WEST_SANTO" | "GUEST_SANTO" | "HARIBHAKTO" | "EXTRA_SEAT";
  notes: string | null;
};

type ItineraryRecord = {
  id: string;
  notes: string | null;
  status: "CREATED" | "CONFIRMED" | "PENDING_APPROVAL" | "CANCELLED";
  passengerNames: string;
  segmentCount: number;
};

type AirportRecord = {
  id: string;
  code: string;
  name: string;
};

type PublicSubmissionRecord = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DUPLICATE_FLAGGED";
  createdAt: string;
  notes: string | null;
  passengerCount: number;
  segmentCount: number;
};

type TransportTaskRecord = {
  id: string;
  taskType: "PICKUP" | "DROPOFF";
  status: "UNASSIGNED" | "ASSIGNED" | "EN_ROUTE" | "PICKED_UP" | "DROPPED_OFF" | "COMPLETED" | "CANCELLED";
  airport: string;
  mandir: string;
  scheduledTimeLocal: string | null;
  driverIds: string[];
  driverNames: string[];
};

type DriverRecord = {
  id: string;
  name: string;
  airportCodes: string[];
};

export function AdminConsole(props: {
  users: UserRecord[];
  passengers: PassengerRecord[];
  itineraries: ItineraryRecord[];
  airports: AirportRecord[];
  publicSubmissions: PublicSubmissionRecord[];
  transportTasks: TransportTaskRecord[];
  drivers: DriverRecord[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  async function submitJson(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Request failed");
    }

    setMessage("Saved.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      {message ? <div className="panel"><strong>{message}</strong></div> : null}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Users</p>
            <h2>Create and update access</h2>
          </div>
        </div>
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await submitJson("/api/users", "POST", {
              firstName: form.get("firstName"),
              lastName: form.get("lastName"),
              email: form.get("email"),
              phone: form.get("phone") || null,
              role: form.get("role"),
            });
            event.currentTarget.reset();
          }}
        >
          <input name="firstName" placeholder="First name" required />
          <input name="lastName" placeholder="Last name" required />
          <input name="email" placeholder="Email" type="email" required />
          <input name="phone" placeholder="Phone" />
          <select name="role" defaultValue="COORDINATOR">
            <option value="ADMIN">Admin</option>
            <option value="COORDINATOR">Coordinator</option>
            <option value="PASSENGER">Passenger</option>
          </select>
          <button disabled={isPending} type="submit">Create user</button>
        </form>
        <div className="stack">
          {props.users.map((user) => (
            <form
              key={user.id}
              className="admin-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                await submitJson(`/api/users/${user.id}`, "PATCH", {
                  firstName: form.get("firstName"),
                  lastName: form.get("lastName"),
                  email: form.get("email"),
                  phone: form.get("phone") || null,
                  role: form.get("role"),
                  isActive: form.get("isActive") === "on",
                });
              }}
            >
              <input name="firstName" defaultValue={user.firstName} required />
              <input name="lastName" defaultValue={user.lastName} required />
              <input name="email" defaultValue={user.email} type="email" required />
              <input name="phone" defaultValue={user.phone ?? ""} />
              <select name="role" defaultValue={user.role}>
                <option value="ADMIN">Admin</option>
                <option value="COORDINATOR">Coordinator</option>
                <option value="PASSENGER">Passenger</option>
              </select>
              <label className="checkbox"><input name="isActive" type="checkbox" defaultChecked={user.isActive} /> Active</label>
              <button disabled={isPending} type="submit">Save</button>
            </form>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Transport</p>
            <h2>Assign drivers and update task status</h2>
          </div>
        </div>
        <div className="stack">
          {props.transportTasks.map((task) => {
            const matchingDrivers = props.drivers.filter((driver) => driver.airportCodes.includes(task.airport));

            return (
              <article key={task.id} className="row-card">
                <div className="row-card__title">
                  <div>
                    <h3>{task.taskType} · {task.airport} to {task.mandir}</h3>
                    <p>{task.scheduledTimeLocal ? new Date(task.scheduledTimeLocal).toLocaleString() : "Not scheduled"}</p>
                  </div>
                  <span className="pill">{task.status}</span>
                </div>

                <div className="row-meta">
                  <span>{task.driverNames.length > 0 ? task.driverNames.join(", ") : "No drivers assigned"}</span>
                  <span>{task.id}</span>
                </div>

                <form
                  className="admin-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const driverIds = form
                      .getAll("driverIds")
                      .map((value) => String(value))
                      .filter(Boolean);

                    await submitJson(`/api/transport-tasks/${task.id}/assign`, "POST", {
                      driverIds,
                    });
                  }}
                >
                  <select name="driverIds" defaultValue={task.driverIds} multiple size={Math.max(2, Math.min(4, matchingDrivers.length || 2))}>
                    {matchingDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} ({driver.airportCodes.join(", ")})
                      </option>
                    ))}
                  </select>
                  <button disabled={isPending} type="submit">Save drivers</button>
                </form>

                <form
                  className="admin-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    await submitJson(`/api/transport-tasks/${task.id}/status`, "POST", {
                      status: form.get("status"),
                      note: form.get("note") || null,
                    });
                  }}
                >
                  <select name="status" defaultValue={task.status}>
                    <option value="UNASSIGNED">Unassigned</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="EN_ROUTE">En Route</option>
                    <option value="PICKED_UP">Picked Up</option>
                    <option value="DROPPED_OFF">Dropped Off</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <input name="note" placeholder="Status note" />
                  <button disabled={isPending} type="submit">Update status</button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Passengers</p>
            <h2>Edit roster data</h2>
          </div>
        </div>
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await submitJson("/api/passengers", "POST", {
              firstName: form.get("firstName"),
              lastName: form.get("lastName"),
              legalName: form.get("legalName") || null,
              email: form.get("email") || null,
              phone: form.get("phone") || null,
              passengerType: form.get("passengerType"),
              notes: form.get("notes") || null,
            });
            event.currentTarget.reset();
          }}
        >
          <input name="firstName" placeholder="First name" required />
          <input name="lastName" placeholder="Last name" required />
          <input name="legalName" placeholder="Legal name" />
          <input name="email" placeholder="Email" type="email" />
          <input name="phone" placeholder="Phone" />
          <select name="passengerType" defaultValue="WEST_SANTO">
            <option value="WEST_SANTO">West Santo</option>
            <option value="GUEST_SANTO">Guest Santo</option>
            <option value="HARIBHAKTO">Haribhakto</option>
            <option value="EXTRA_SEAT">Extra Seat</option>
          </select>
          <input name="notes" placeholder="Notes" />
          <button disabled={isPending} type="submit">Create passenger</button>
        </form>
        <div className="stack">
          {props.passengers.map((passenger) => (
            <form
              key={passenger.id}
              className="admin-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                await submitJson(`/api/passengers/${passenger.id}`, "PATCH", {
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
              <input name="firstName" defaultValue={passenger.firstName} required />
              <input name="lastName" defaultValue={passenger.lastName} required />
              <input name="legalName" defaultValue={passenger.legalName ?? ""} />
              <input name="email" defaultValue={passenger.email ?? ""} type="email" />
              <input name="phone" defaultValue={passenger.phone ?? ""} />
              <select name="passengerType" defaultValue={passenger.passengerType}>
                <option value="WEST_SANTO">West Santo</option>
                <option value="GUEST_SANTO">Guest Santo</option>
                <option value="HARIBHAKTO">Haribhakto</option>
                <option value="EXTRA_SEAT">Extra Seat</option>
              </select>
              <input name="notes" defaultValue={passenger.notes ?? ""} />
              <button disabled={isPending} type="submit">Save</button>
            </form>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Itineraries</p>
            <h2>Create trips and add flights</h2>
          </div>
        </div>
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const passengerIds = String(form.get("passengerIds"))
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean);
            await submitJson("/api/itineraries", "POST", {
              notes: form.get("notes") || null,
              passengerIds,
            });
            event.currentTarget.reset();
          }}
        >
          <input name="notes" placeholder="Itinerary notes" />
          <input name="passengerIds" placeholder="Passenger IDs, comma-separated" required />
          <button disabled={isPending} type="submit">Create itinerary</button>
        </form>
        <div className="stack">
          {props.itineraries.map((itinerary) => (
            <div key={itinerary.id} className="row-card">
              <div className="row-card__title">
                <div>
                  <h3>{itinerary.passengerNames || itinerary.id}</h3>
                  <p>{itinerary.id}</p>
                </div>
                <span className="pill">{itinerary.status}</span>
              </div>
              <form
                className="admin-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  await submitJson(`/api/itineraries/${itinerary.id}`, "PATCH", {
                    notes: form.get("notes") || null,
                    status: form.get("status"),
                  });
                }}
              >
                <input name="notes" defaultValue={itinerary.notes ?? ""} />
                <select name="status" defaultValue={itinerary.status}>
                  <option value="CREATED">Created</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <button disabled={isPending} type="submit">Save itinerary</button>
              </form>
              <form
                className="admin-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  await submitJson(`/api/itineraries/${itinerary.id}/segments`, "POST", {
                    segmentOrder: Number(form.get("segmentOrder")),
                    airline: form.get("airline"),
                    flightNumber: form.get("flightNumber"),
                    departureAirportId: form.get("departureAirportId"),
                    arrivalAirportId: form.get("arrivalAirportId"),
                    departureTimeLocal: form.get("departureTimeLocal"),
                    arrivalTimeLocal: form.get("arrivalTimeLocal"),
                    notes: form.get("notes") || null,
                  });
                  event.currentTarget.reset();
                }}
              >
                <input name="segmentOrder" type="number" min="1" placeholder={`Next segment (${itinerary.segmentCount + 1})`} required />
                <input name="airline" placeholder="Airline" required />
                <input name="flightNumber" placeholder="Flight #" required />
                <select name="departureAirportId" defaultValue={props.airports[0]?.id} required>
                  {props.airports.map((airport) => (
                    <option key={airport.id} value={airport.id}>{airport.code} - {airport.name}</option>
                  ))}
                </select>
                <select name="arrivalAirportId" defaultValue={props.airports[1]?.id ?? props.airports[0]?.id} required>
                  {props.airports.map((airport) => (
                    <option key={airport.id} value={airport.id}>{airport.code} - {airport.name}</option>
                  ))}
                </select>
                <input name="departureTimeLocal" type="datetime-local" required />
                <input name="arrivalTimeLocal" type="datetime-local" required />
                <input name="notes" placeholder="Segment notes" />
                <button disabled={isPending} type="submit">Add flight</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Public submissions</p>
            <h2>Guest flight intake awaiting review</h2>
          </div>
        </div>
        <div className="stack">
          {props.publicSubmissions.length === 0 ? (
            <p>No public submissions yet.</p>
          ) : (
            props.publicSubmissions.map((submission) => (
              <article key={submission.id} className="row-card">
                <div className="row-card__title">
                  <div>
                    <h3>{submission.id}</h3>
                    <p>{new Date(submission.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="pill">{submission.status}</span>
                </div>
                <div className="row-meta">
                  <span>{submission.passengerCount} passenger(s)</span>
                  <span>{submission.segmentCount} segment(s)</span>
                  <span>{submission.notes || "No notes"}</span>
                </div>
                {submission.status === "PENDING" ? (
                  <form
                    className="admin-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const status = String(form.get("status") ?? "");

                      await submitJson(`/api/public-submissions/${submission.id}/review`, "POST", {
                        status,
                        reviewNote: form.get("reviewNote") || null,
                      });
                    }}
                  >
                    <input name="reviewNote" placeholder="Review note" />
                    <button disabled={isPending} name="status" type="submit" value="APPROVED">Approve</button>
                    <button disabled={isPending} name="status" type="submit" value="REJECTED">Reject</button>
                    <button disabled={isPending} name="status" type="submit" value="DUPLICATE_FLAGGED">Flag duplicate</button>
                  </form>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
