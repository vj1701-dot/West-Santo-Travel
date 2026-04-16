"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AirportAutocomplete, type AirportChoice } from "./airport-autocomplete";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { SearchCombobox } from "./search-combobox";
import { AIRLINE_OPTIONS } from "@/lib/airlines";

type PassengerOption = {
  id: string;
  label: string;
  detail?: string;
};

type DriverOption = {
  id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  airportCodes?: string[];
};

type TransportEntryState = {
  id: string;
  taskType: "PICKUP" | "DROPOFF";
  driverIds: string[];
  notes: string;
};

type SegmentState = {
  id: string;
  airline: string;
  flightNumber: string;
  departureAirportId: string;
  departureAirport: AirportChoice | null;
  arrivalAirportId: string;
  arrivalAirport: AirportChoice | null;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  pickupEntries: TransportEntryState[];
  dropoffEntries: TransportEntryState[];
};

type InitialTripData = {
  id?: string;
  notes?: string | null;
  passengerIds: string[];
  booking?: {
    confirmationNumber?: string | null;
    totalCost?: number | null;
  } | null;
  accommodation?: {
    notes?: string | null;
  } | null;
  segments: Array<{
    airline: string;
    flightNumber: string;
    departureAirportId: string;
    arrivalAirportId: string;
    departureTimeLocal: string;
    arrivalTimeLocal: string;
    transportEntries?: Array<{
      taskType: "PICKUP" | "DROPOFF";
      driverIds: string[];
      notes?: string | null;
    }>;
  }>;
};

type TripBuilderProps = {
  passengers: PassengerOption[];
  drivers: DriverOption[];
  airports: AirportChoice[];
  initialTrip?: InitialTripData;
  submitUrl?: string;
  method?: "POST" | "PATCH";
  submitLabel?: string;
  successPath?: string;
};

type SearchOption = {
  id: string;
  label: string;
  detail?: string;
};

function generateId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createTransportEntry(taskType: "PICKUP" | "DROPOFF", entry?: Partial<TransportEntryState>): TransportEntryState {
  return {
    id: generateId(taskType.toLowerCase()),
    taskType,
    driverIds: entry?.driverIds ?? [],
    notes: entry?.notes ?? "",
  };
}

function createSegment(airports: AirportChoice[], source?: InitialTripData["segments"][number]): SegmentState {
  const departureAirport = source?.departureAirportId ? airports.find((airport) => airport.id === source.departureAirportId) ?? null : null;
  const arrivalAirport = source?.arrivalAirportId ? airports.find((airport) => airport.id === source.arrivalAirportId) ?? null : null;

  return {
    id: generateId("segment"),
    airline: source?.airline ?? "",
    flightNumber: source?.flightNumber ?? "",
    departureAirportId: source?.departureAirportId ?? "",
    departureAirport,
    arrivalAirportId: source?.arrivalAirportId ?? "",
    arrivalAirport,
    departureTimeLocal: source?.departureTimeLocal ?? "",
    arrivalTimeLocal: source?.arrivalTimeLocal ?? "",
    pickupEntries:
      source?.transportEntries
        ?.filter((entry) => entry.taskType === "PICKUP")
        .map((entry) => createTransportEntry("PICKUP", { driverIds: entry.driverIds, notes: entry.notes ?? "" })) ?? [],
    dropoffEntries:
      source?.transportEntries
        ?.filter((entry) => entry.taskType === "DROPOFF")
        .map((entry) => createTransportEntry("DROPOFF", { driverIds: entry.driverIds, notes: entry.notes ?? "" })) ?? [],
  };
}

export function TripBuilder({
  passengers,
  drivers,
  airports,
  initialTrip,
  submitUrl = "/api/itineraries",
  method = "POST",
  submitLabel = "Save trip",
  successPath = "/itineraries",
}: TripBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>(initialTrip?.passengerIds ?? []);
  const [passengerQuery, setPassengerQuery] = useState("");
  const [segments, setSegments] = useState<SegmentState[]>(
    initialTrip?.segments?.length ? initialTrip.segments.map((segment) => createSegment(airports, segment)) : [createSegment(airports)],
  );
  const [bookingId, setBookingId] = useState(initialTrip?.booking?.confirmationNumber ?? "");
  const [totalPrice, setTotalPrice] = useState(initialTrip?.booking?.totalCost?.toString() ?? "");
  const [tripNote, setTripNote] = useState(initialTrip?.notes ?? "");
  const [accommodationNote, setAccommodationNote] = useState(initialTrip?.accommodation?.notes ?? "");
  const [driverFormSegmentId, setDriverFormSegmentId] = useState<string | null>(null);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverNotes, setNewDriverNotes] = useState("");
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>(drivers);

  const passengerOptions: SearchOption[] = useMemo(
    () => passengers.map((passenger) => ({ id: passenger.id, label: passenger.label, detail: passenger.detail })),
    [passengers],
  );
  const selectedPassengers = passengers.filter((passenger) => selectedPassengerIds.includes(passenger.id));
  const availablePassengerOptions = passengerOptions.filter((passenger) => !selectedPassengerIds.includes(passenger.id));
  const airlineOptions = AIRLINE_OPTIONS.map((airline) => ({ id: airline, label: airline }));
  const driverSearchOptions = driverOptions.map((driver) => ({
    id: driver.id,
    label: driver.name,
    detail: [driver.phone, driver.airportCodes?.join(", ")].filter(Boolean).join(" · "),
  }));

  function updateSegment(segmentId: string, nextValue: Partial<SegmentState>) {
    setSegments((current) => current.map((segment) => (segment.id === segmentId ? { ...segment, ...nextValue } : segment)));
  }

  function updateTransportEntry(
    segmentId: string,
    taskType: "PICKUP" | "DROPOFF",
    entryId: string,
    nextValue: Partial<TransportEntryState>,
  ) {
    setSegments((current) =>
      current.map((segment) => {
        if (segment.id !== segmentId) return segment;
        const key = taskType === "PICKUP" ? "pickupEntries" : "dropoffEntries";
        return {
          ...segment,
          [key]: segment[key].map((entry) => (entry.id === entryId ? { ...entry, ...nextValue } : entry)),
        };
      }),
    );
  }

  async function createDriverInline() {
    const response = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDriverName.trim(),
        phone: newDriverPhone.trim() || null,
        notes: newDriverNotes.trim() || null,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to create driver.");
      return;
    }

    setDriverOptions((current) => [
      ...current,
      {
        id: result.id,
        name: result.name,
        phone: result.phone,
        notes: result.notes,
        airportCodes: result.driverAirports?.map((item: { airport: { code: string } }) => item.airport.code) ?? [],
      },
    ]);
    setNewDriverName("");
    setNewDriverPhone("");
    setNewDriverNotes("");
    setDriverFormSegmentId(null);
    setMessage("Driver added.");
  }

  async function handleSubmit() {
    const invalidSegment = segments.find(
      (segment) =>
        !segment.airline ||
        !segment.flightNumber ||
        !segment.departureAirportId ||
        !segment.arrivalAirportId ||
        !segment.departureTimeLocal ||
        !segment.arrivalTimeLocal,
    );

    if (selectedPassengerIds.length === 0) {
      setMessage("Select at least one passenger.");
      return;
    }

    if (invalidSegment) {
      setMessage("Complete every flight segment before saving.");
      return;
    }

    const payload = {
      notes: tripNote.trim() || null,
      passengerIds: selectedPassengerIds,
      booking: bookingId.trim() || totalPrice.trim() ? { confirmationNumber: bookingId.trim() || null, totalCost: totalPrice.trim() ? Number(totalPrice) : null } : null,
      accommodation: accommodationNote.trim() ? { notes: accommodationNote.trim() } : null,
      segments: segments.map((segment, index) => ({
        segmentOrder: index + 1,
        airline: segment.airline.trim(),
        flightNumber: segment.flightNumber.trim(),
        departureAirportId: segment.departureAirportId,
        arrivalAirportId: segment.arrivalAirportId,
        departureTimeLocal: segment.departureTimeLocal,
        arrivalTimeLocal: segment.arrivalTimeLocal,
        transportEntries: [...segment.pickupEntries, ...segment.dropoffEntries].map((entry) => ({
          taskType: entry.taskType,
          driverIds: entry.driverIds,
          notes: entry.notes.trim() || null,
        })),
      })),
    };

    const response = await fetch(submitUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to save trip.");
      return;
    }

    setMessage(response.status === 202 ? "Changes submitted for approval." : "Trip saved.");
    startTransition(() => {
      router.push(successPath);
      router.refresh();
    });
  }

  return (
    <section className="stack">
      {message ? <div className="compact-card"><p>{message}</p></div> : null}

      <div className="stack">
        <Accordion type="multiple" defaultValue={["passengers", "segments", "booking", "transport", "accommodation"]}>
          <AccordionItem value="passengers">
            <AccordionTrigger>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Passengers</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  {selectedPassengerIds.length === 0
                    ? "Search passengers and add them to this trip"
                    : `${selectedPassengerIds.length} passenger${selectedPassengerIds.length === 1 ? "" : "s"} selected`}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="stack">
                <SearchCombobox
                  clearOnSelect
                  label="Passenger name"
                  onSelect={(option) => {
                    setSelectedPassengerIds((current) => (current.includes(option.id) ? current : [...current, option.id]));
                  }}
                  onValueChange={setPassengerQuery}
                  options={availablePassengerOptions}
                  placeholder="Type a passenger name"
                  value={passengerQuery}
                />
                {selectedPassengers.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.6rem",
                      padding: "0.85rem 1rem",
                      border: "1px solid var(--line)",
                      borderRadius: "0.9rem",
                      background: "var(--bg-soft)",
                    }}
                  >
                    <p className="eyebrow" style={{ margin: 0 }}>
                      Selected passengers
                    </p>
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
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>

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
                  onClick={(event) => {
                    event.stopPropagation();
                    setSegments((current) => [...current, createSegment(airports)]);
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
                  <article key={segment.id} className="compact-card segment-card" style={{ padding: "1rem" }}>
                    <div className="segment-card__header">
                      <div>
                        <p className="eyebrow">Segment {index + 1}</p>
                        <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "var(--slate-900)", margin: 0 }}>
                          {segment.departureAirport?.code ?? "DEP"} → {segment.arrivalAirport?.code ?? "ARR"}
                        </h3>
                      </div>
                      {segments.length > 1 ? (
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => setSegments((current) => current.filter((item) => item.id !== segment.id))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <SearchCombobox
                        label="Airline"
                        onSelect={(option) => updateSegment(segment.id, { airline: option.label })}
                        onValueChange={(value) => updateSegment(segment.id, { airline: value })}
                        options={airlineOptions}
                        placeholder="Type an airline"
                        value={segment.airline}
                      />
                      <label className="field">
                        <span>Flight number</span>
                        <input
                          value={segment.flightNumber}
                          onChange={(event) => updateSegment(segment.id, { flightNumber: event.target.value })}
                          placeholder="e.g. UA123"
                        />
                      </label>
                      <AirportAutocomplete
                        airports={airports}
                        label="Departure airport"
                        onSelect={(airport) =>
                          updateSegment(segment.id, { departureAirportId: airport.id, departureAirport: airport })
                        }
                        value={segment.departureAirport}
                      />
                      <AirportAutocomplete
                        airports={airports}
                        label="Arrival airport"
                        onSelect={(airport) => updateSegment(segment.id, { arrivalAirportId: airport.id, arrivalAirport: airport })}
                        value={segment.arrivalAirport}
                      />
                      <label className="field">
                        <span>Departure time</span>
                        <input
                          type="datetime-local"
                          value={segment.departureTimeLocal}
                          onChange={(event) => updateSegment(segment.id, { departureTimeLocal: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Arrival time</span>
                        <input
                          type="datetime-local"
                          value={segment.arrivalTimeLocal}
                          onChange={(event) => updateSegment(segment.id, { arrivalTimeLocal: event.target.value })}
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="booking">
            <AccordionTrigger>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Booking Details</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  Booking ID, total price, and trip note
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="stack">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field">
                    <span>Booking ID</span>
                    <input value={bookingId} onChange={(event) => setBookingId(event.target.value)} placeholder="PNR / confirmation number" />
                  </label>
                  <label className="field">
                    <span>Total price</span>
                    <input value={totalPrice} onChange={(event) => setTotalPrice(event.target.value)} min="0" placeholder="0.00" step="0.01" type="number" />
                  </label>
                </div>
                <label className="field">
                  <span>Trip note</span>
                  <textarea rows={3} value={tripNote} onChange={(event) => setTripNote(event.target.value)} />
                </label>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="transport">
            <AccordionTrigger>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Pickup and Dropoff Details</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  Add as many pickup and dropoff entries as needed for each segment
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="stack">
                {segments.map((segment, index) => (
                  <article key={`${segment.id}-transport`} className="compact-card" style={{ padding: "1rem" }}>
                    <div className="row-card__title">
                      <div>
                        <p className="eyebrow">Segment {index + 1}</p>
                        <h3 style={{ margin: 0 }}>{segment.departureAirport?.code ?? "DEP"} → {segment.arrivalAirport?.code ?? "ARR"}</h3>
                      </div>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => setDriverFormSegmentId((current) => (current === segment.id ? null : segment.id))}
                      >
                        Add new driver
                      </button>
                    </div>

                    {driverFormSegmentId === segment.id ? (
                      <div className="grid gap-3 sm:grid-cols-2" style={{ marginBottom: "1rem" }}>
                        <label className="field">
                          <span>Driver name</span>
                          <input value={newDriverName} onChange={(event) => setNewDriverName(event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Phone</span>
                          <input value={newDriverPhone} onChange={(event) => setNewDriverPhone(event.target.value)} />
                        </label>
                        <label className="field" style={{ gridColumn: "1 / -1" }}>
                          <span>Notes</span>
                          <textarea rows={2} value={newDriverNotes} onChange={(event) => setNewDriverNotes(event.target.value)} />
                        </label>
                        <div className="actions-row" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                          <button className="button-secondary" type="button" onClick={() => setDriverFormSegmentId(null)}>
                            Cancel
                          </button>
                          <button type="button" onClick={() => void createDriverInline()} disabled={!newDriverName.trim()}>
                            Save driver
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <TransportEntrySection
                      driverOptions={driverSearchOptions}
                      entries={segment.pickupEntries}
                      label="Pickup entries"
                      onAdd={() =>
                        updateSegment(segment.id, {
                          pickupEntries: [...segment.pickupEntries, createTransportEntry("PICKUP")],
                        })
                      }
                      onChange={(entryId, nextValue) => updateTransportEntry(segment.id, "PICKUP", entryId, nextValue)}
                      onRemove={(entryId) =>
                        updateSegment(segment.id, {
                          pickupEntries: segment.pickupEntries.filter((entry) => entry.id !== entryId),
                        })
                      }
                    />
                    <TransportEntrySection
                      driverOptions={driverSearchOptions}
                      entries={segment.dropoffEntries}
                      label="Dropoff entries"
                      onAdd={() =>
                        updateSegment(segment.id, {
                          dropoffEntries: [...segment.dropoffEntries, createTransportEntry("DROPOFF")],
                        })
                      }
                      onChange={(entryId, nextValue) => updateTransportEntry(segment.id, "DROPOFF", entryId, nextValue)}
                      onRemove={(entryId) =>
                        updateSegment(segment.id, {
                          dropoffEntries: segment.dropoffEntries.filter((entry) => entry.id !== entryId),
                        })
                      }
                    />
                  </article>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="accommodation">
            <AccordionTrigger>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Accommodation</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  Notes only
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <label className="field">
                <span>Accommodation notes</span>
                <textarea rows={3} value={accommodationNote} onChange={(event) => setAccommodationNote(event.target.value)} />
              </label>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="actions-row" style={{ marginTop: "1.5rem" }}>
          <button disabled={isPending} type="button" onClick={() => void handleSubmit()}>
            {isPending ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function TransportEntrySection({
  label,
  entries,
  driverOptions,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string;
  entries: TransportEntryState[];
  driverOptions: SearchOption[];
  onAdd: () => void;
  onChange: (entryId: string, nextValue: Partial<TransportEntryState>) => void;
  onRemove: (entryId: string) => void;
}) {
  return (
    <div className="stack" style={{ marginTop: "1rem" }}>
      <div className="row-card__title">
        <h4 style={{ margin: 0, fontSize: "1rem" }}>{label}</h4>
        <button className="button-secondary" type="button" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {entries.length === 0 ? <p className="notes">No entries added yet.</p> : null}
      {entries.map((entry) => (
        <div key={entry.id} className="compact-card" style={{ padding: "0.85rem" }}>
          <div className="row-card__title">
            <span className="pill">{entry.taskType}</span>
            <button className="button-secondary" type="button" onClick={() => onRemove(entry.id)}>
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
          <DriverMultiSelect
            driverOptions={driverOptions}
            selectedIds={entry.driverIds}
            onChange={(driverIds) => onChange(entry.id, { driverIds })}
          />
          <label className="field" style={{ marginTop: "0.75rem" }}>
            <span>Transport notes</span>
            <textarea rows={2} value={entry.notes} onChange={(event) => onChange(entry.id, { notes: event.target.value })} />
          </label>
        </div>
      ))}
    </div>
  );
}

function DriverMultiSelect({
  driverOptions,
  selectedIds,
  onChange,
}: {
  driverOptions: SearchOption[];
  selectedIds: string[];
  onChange: (driverIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedDrivers = driverOptions.filter((driver) => selectedIds.includes(driver.id));
  const availableDrivers = driverOptions.filter((driver) => !selectedIds.includes(driver.id));

  return (
    <div className="stack stack--tight">
      <SearchCombobox
        clearOnSelect
        label="Volunteer name"
        onSelect={(option) => onChange([...selectedIds, option.id])}
        onValueChange={setQuery}
        options={availableDrivers}
        placeholder="Search drivers"
        value={query}
      />
      {selectedDrivers.length > 0 ? (
        <div className="chip-row">
          {selectedDrivers.map((driver) => (
            <button key={driver.id} className="chip" type="button" onClick={() => onChange(selectedIds.filter((id) => id !== driver.id))}>
              <Pencil className="h-3.5 w-3.5" /> {driver.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
