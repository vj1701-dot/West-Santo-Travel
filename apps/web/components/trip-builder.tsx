"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

type Option = {
  id: string;
  label: string;
  detail?: string;
};

type MandirOption = {
  id: string;
  name: string;
};

type SegmentState = {
  id: string;
  airline: string;
  flightNumber: string;
  departureAirportId: string;
  arrivalAirportId: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  notes: string;
};

const emptySegment = (): SegmentState => ({
  id: crypto.randomUUID(),
  airline: "",
  flightNumber: "",
  departureAirportId: "",
  arrivalAirportId: "",
  departureTimeLocal: "",
  arrivalTimeLocal: "",
  notes: "",
});

export function TripBuilder({
  passengers,
  airports,
  mandirs,
}: {
  passengers: Option[];
  airports: Option[];
  mandirs: MandirOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>([]);
  const [passengerQuery, setPassengerQuery] = useState("");
  const [segments, setSegments] = useState<SegmentState[]>([emptySegment()]);

  const availablePassengers = useMemo(
    () => passengers.filter((passenger) => !selectedPassengerIds.includes(passenger.id)),
    [passengers, selectedPassengerIds],
  );

  const selectedPassengers = useMemo(
    () => passengers.filter((passenger) => selectedPassengerIds.includes(passenger.id)),
    [passengers, selectedPassengerIds],
  );

  async function handleSubmit(formData: FormData) {
    const totalCostRaw = String(formData.get("totalCost") ?? "").trim();
    const payload = {
      notes: String(formData.get("notes") ?? "").trim() || null,
      passengerIds: selectedPassengerIds,
      booking: {
        confirmationNumber: String(formData.get("confirmationNumber") ?? "").trim() || null,
        totalCost: totalCostRaw ? Number(totalCostRaw) : null,
        notes: String(formData.get("bookingNotes") ?? "").trim() || null,
      },
      accommodation: formData.get("mandirId")
        ? {
            mandirId: String(formData.get("mandirId")),
            room: String(formData.get("room") ?? "").trim() || null,
            checkInDate: String(formData.get("checkInDate") ?? "").trim() || null,
            checkOutDate: String(formData.get("checkOutDate") ?? "").trim() || null,
            notes: String(formData.get("accommodationNotes") ?? "").trim() || null,
          }
        : null,
      transportNotes: String(formData.get("transportNotes") ?? "").trim() || null,
      segments: segments.map((segment, index) => ({
        segmentOrder: index + 1,
        airline: segment.airline,
        flightNumber: segment.flightNumber,
        departureAirportId: segment.departureAirportId,
        arrivalAirportId: segment.arrivalAirportId,
        departureTimeLocal: segment.departureTimeLocal,
        arrivalTimeLocal: segment.arrivalTimeLocal,
        notes: segment.notes || null,
      })),
    };

    const response = await fetch("/api/itineraries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to create trip.");
      return;
    }

    setMessage("Trip saved.");
    setSelectedPassengerIds([]);
    setPassengerQuery("");
    setSegments([emptySegment()]);
    startTransition(() => router.refresh());
  }

  return (
    <section className="stack">
      {message ? (
        <div
          className="compact-card"
          style={{
            padding: "0.75rem 1rem",
            background: message.includes("saved") ? "var(--success-light)" : "var(--error-light)",
            color: message.includes("saved") ? "var(--success)" : "var(--error)",
            borderLeft: `3px solid ${message.includes("saved") ? "var(--success)" : "var(--error)"}`,
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>{message}</p>
        </div>
      ) : null}

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedPassengerIds.length === 0) {
            setMessage("Select at least one passenger.");
            return;
          }

          const invalidSegment = segments.find(
            (segment) =>
              !segment.airline ||
              !segment.flightNumber ||
              !segment.departureAirportId ||
              !segment.arrivalAirportId ||
              !segment.departureTimeLocal ||
              !segment.arrivalTimeLocal,
          );

          if (invalidSegment) {
            setMessage("Complete every flight segment before saving.");
            return;
          }

          void handleSubmit(new FormData(event.currentTarget));
        }}
      >
        <Accordion type="multiple" defaultValue={["passengers", "segments"]}>
          {/* Passenger Selection */}
          <AccordionItem value="passengers">
            <AccordionTrigger>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Passenger Selection</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  {selectedPassengerIds.length === 0
                    ? "Search and add passengers to this trip"
                    : `${selectedPassengerIds.length} passenger${selectedPassengerIds.length === 1 ? "" : "s"} selected`}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="stack">
                <label className="field">
                  <span>Search passengers</span>
                  <input
                    list="passenger-options"
                    value={passengerQuery}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPassengerQuery(value);
                      const match = availablePassengers.find((passenger) => value === `${passenger.label} (${passenger.detail ?? ""})`);
                      if (match) {
                        setSelectedPassengerIds((current) => [...current, match.id]);
                        setPassengerQuery("");
                      }
                    }}
                    placeholder="Type passenger name"
                  />
                  <datalist id="passenger-options">
                    {availablePassengers.map((passenger) => (
                      <option key={passenger.id} value={`${passenger.label} (${passenger.detail ?? ""})`} />
                    ))}
                  </datalist>
                </label>
                {selectedPassengers.length > 0 && (
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "var(--slate-600)", marginBottom: "0.5rem" }}>Selected passengers:</p>
                    <div className="chip-row">
                      {selectedPassengers.map((passenger) => (
                        <button
                          key={passenger.id}
                          className="chip"
                          type="button"
                          onClick={() => setSelectedPassengerIds((current) => current.filter((id) => id !== passenger.id))}
                        >
                          {passenger.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Flight Segments */}
          <AccordionItem value="segments">
            <AccordionTrigger>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div>
                  <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Flight Segments</strong>
                  <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                    {segments.length} segment{segments.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSegments((current) => [...current, emptySegment()]);
                  }}
                  style={{ marginRight: "2rem" }}
                >
                  Add segment
                </button>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="stack">
                {segments.map((segment, index) => (
                  <article key={segment.id} className="compact-card" style={{ padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--slate-700)", margin: 0 }}>
                        Segment {index + 1}
                      </h3>
                      {segments.length > 1 && (
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => setSegments((current) => current.filter((item) => item.id !== segment.id))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <label className="field">
                        <span>Airline</span>
                        <input
                          value={segment.airline}
                          onChange={(event) =>
                            setSegments((current) =>
                              current.map((item) => (item.id === segment.id ? { ...item, airline: event.target.value } : item)),
                            )
                          }
                          placeholder="e.g. United"
                        />
                      </label>
                      <label className="field">
                        <span>Flight number</span>
                        <input
                          value={segment.flightNumber}
                          onChange={(event) =>
                            setSegments((current) =>
                              current.map((item) => (item.id === segment.id ? { ...item, flightNumber: event.target.value } : item)),
                            )
                          }
                          placeholder="e.g. UA123"
                        />
                      </label>
                      <AirportSelect
                        airports={airports}
                        label="Departure airport"
                        value={segment.departureAirportId}
                        onChange={(value) =>
                          setSegments((current) =>
                            current.map((item) => (item.id === segment.id ? { ...item, departureAirportId: value } : item)),
                          )
                        }
                      />
                      <AirportSelect
                        airports={airports}
                        label="Arrival airport"
                        value={segment.arrivalAirportId}
                        onChange={(value) =>
                          setSegments((current) =>
                            current.map((item) => (item.id === segment.id ? { ...item, arrivalAirportId: value } : item)),
                          )
                        }
                      />
                      <label className="field">
                        <span>Departure time</span>
                        <input
                          type="datetime-local"
                          value={segment.departureTimeLocal}
                          onChange={(event) =>
                            setSegments((current) =>
                              current.map((item) => (item.id === segment.id ? { ...item, departureTimeLocal: event.target.value } : item)),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Arrival time</span>
                        <input
                          type="datetime-local"
                          value={segment.arrivalTimeLocal}
                          onChange={(event) =>
                            setSegments((current) =>
                              current.map((item) => (item.id === segment.id ? { ...item, arrivalTimeLocal: event.target.value } : item)),
                            )
                          }
                        />
                      </label>
                    </div>
                    <label className="field" style={{ marginTop: "0.75rem" }}>
                      <span>Segment notes</span>
                      <textarea
                        rows={2}
                        value={segment.notes}
                        onChange={(event) =>
                          setSegments((current) =>
                            current.map((item) => (item.id === segment.id ? { ...item, notes: event.target.value } : item)),
                          )
                        }
                        placeholder="Optional notes for this flight segment"
                      />
                    </label>
                  </article>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Booking Details */}
          <AccordionItem value="booking">
            <AccordionTrigger>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Booking Details</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  Confirmation number, total cost, and trip notes
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="stack">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field">
                    <span>Booking ID</span>
                    <input name="confirmationNumber" placeholder="PNR / confirmation number" />
                  </label>
                  <label className="field">
                    <span>Total price</span>
                    <input name="totalCost" min="0" placeholder="0.00" step="0.01" type="number" />
                  </label>
                </div>
                <label className="field">
                  <span>Trip notes</span>
                  <textarea name="notes" placeholder="Trip-level notes, pickup context, or booking remarks" rows={3} />
                </label>
                <label className="field">
                  <span>Booking notes</span>
                  <textarea name="bookingNotes" placeholder="Extra booking details" rows={2} />
                </label>
                <label className="field">
                  <span>Transport notes</span>
                  <textarea name="transportNotes" placeholder="Pickup details, special luggage, or airport handling notes" rows={2} />
                </label>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Accommodation */}
          <AccordionItem value="accommodation">
            <AccordionTrigger>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Accommodation</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  Optional stay details and check-in/out dates
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="stack">
                <label className="field">
                  <span>Mandir</span>
                  <select defaultValue="" name="mandirId">
                    <option value="">No accommodation</option>
                    {mandirs.map((mandir) => (
                      <option key={mandir.id} value={mandir.id}>
                        {mandir.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Room</span>
                  <input name="room" placeholder="Room or host details" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field">
                    <span>Check-in</span>
                    <input name="checkInDate" type="date" />
                  </label>
                  <label className="field">
                    <span>Check-out</span>
                    <input name="checkOutDate" type="date" />
                  </label>
                </div>
                <label className="field">
                  <span>Accommodation notes</span>
                  <textarea name="accommodationNotes" placeholder="Details about the stay" rows={2} />
                </label>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="actions-row" style={{ marginTop: "1.5rem" }}>
          <button disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save trip"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AirportSelect({
  airports,
  label,
  value,
  onChange,
}: {
  airports: Option[];
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select airport</option>
        {airports.map((airport) => (
          <option key={airport.id} value={airport.id}>
            {airport.label} {airport.detail ? `· ${airport.detail}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
