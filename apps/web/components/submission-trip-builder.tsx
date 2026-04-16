"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AirportAutocomplete, type AirportChoice } from "./airport-autocomplete";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { SearchCombobox } from "./search-combobox";
import { AIRLINE_OPTIONS } from "@/lib/airlines";

type PassengerDraft = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  passengerType: "WEST_SANTO" | "GUEST_SANTO" | "HARIBHAKTO" | "EXTRA_SEAT";
};

type DriverOption = {
  id: string;
  name: string;
  phone?: string | null;
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
  departureAirport: AirportChoice | null;
  arrivalAirport: AirportChoice | null;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  pickupEntries: TransportEntryState[];
  dropoffEntries: TransportEntryState[];
};

type InitialSubmissionTrip = {
  submitterName?: string | null;
  submitterPhone?: string | null;
  notes?: string | null;
  passengers?: Array<{
    firstName: string;
    lastName: string;
    phone?: string | null;
    passengerType?: PassengerDraft["passengerType"];
  }>;
  booking?: {
    confirmationNumber?: string | null;
    totalCost?: number | null;
  } | null;
  accommodation?: {
    notes?: string | null;
  } | null;
  segments?: Array<{
    airline: string;
    flightNumber: string;
    departureAirportId?: string;
    arrivalAirportId?: string;
    departureAirportCode?: string;
    arrivalAirportCode?: string;
    departureTimeLocal: string;
    arrivalTimeLocal: string;
    transportEntries?: Array<{
      taskType: "PICKUP" | "DROPOFF";
      driverIds?: string[];
      notes?: string | null;
    }>;
  }>;
};

type Props = {
  mode: "public" | "review";
  airports: AirportChoice[];
  drivers?: DriverOption[];
  initialValue?: InitialSubmissionTrip;
  submitUrl: string;
  submitLabel: string;
  successPath?: string;
};

function generateId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type InitialPassenger = NonNullable<InitialSubmissionTrip["passengers"]>[number];
type InitialSegment = NonNullable<InitialSubmissionTrip["segments"]>[number];
type InitialTransportEntry = NonNullable<InitialSegment["transportEntries"]>[number];

function createPassenger(passenger?: InitialPassenger): PassengerDraft {
  return {
    id: generateId("passenger"),
    firstName: passenger?.firstName ?? "",
    lastName: passenger?.lastName ?? "",
    phone: passenger?.phone ?? "",
    passengerType: passenger?.passengerType ?? "GUEST_SANTO",
  };
}

function createTransportEntry(taskType: "PICKUP" | "DROPOFF", entry?: Partial<TransportEntryState>): TransportEntryState {
  return {
    id: generateId(taskType.toLowerCase()),
    taskType,
    driverIds: entry?.driverIds ?? [],
    notes: entry?.notes ?? "",
  };
}

function createSegment(airports: AirportChoice[], segment?: InitialSegment): SegmentState {
  const departureAirport =
    airports.find((airport) => airport.id === segment?.departureAirportId || airport.code === segment?.departureAirportCode) ?? null;
  const arrivalAirport =
    airports.find((airport) => airport.id === segment?.arrivalAirportId || airport.code === segment?.arrivalAirportCode) ?? null;

  return {
    id: generateId("segment"),
    airline: segment?.airline ?? "",
    flightNumber: segment?.flightNumber ?? "",
    departureAirport,
    arrivalAirport,
    departureTimeLocal: segment?.departureTimeLocal ?? "",
    arrivalTimeLocal: segment?.arrivalTimeLocal ?? "",
    pickupEntries:
      segment?.transportEntries
        ?.filter((entry) => entry.taskType === "PICKUP")
        .map((entry: InitialTransportEntry) =>
          createTransportEntry("PICKUP", { driverIds: entry.driverIds ?? [], notes: entry.notes ?? "" }),
        ) ?? [],
    dropoffEntries:
      segment?.transportEntries
        ?.filter((entry) => entry.taskType === "DROPOFF")
        .map((entry: InitialTransportEntry) =>
          createTransportEntry("DROPOFF", { driverIds: entry.driverIds ?? [], notes: entry.notes ?? "" }),
        ) ?? [],
  };
}

export function SubmissionTripBuilder({
  mode,
  airports,
  drivers = [],
  initialValue,
  submitUrl,
  submitLabel,
  successPath,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [submitterName, setSubmitterName] = useState(initialValue?.submitterName ?? "");
  const [submitterPhone, setSubmitterPhone] = useState(initialValue?.submitterPhone ?? "");
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const [bookingId, setBookingId] = useState(initialValue?.booking?.confirmationNumber ?? "");
  const [totalPrice, setTotalPrice] = useState(initialValue?.booking?.totalCost?.toString() ?? "");
  const [accommodationNote, setAccommodationNote] = useState(initialValue?.accommodation?.notes ?? "");
  const [passengers, setPassengers] = useState<PassengerDraft[]>(
    initialValue?.passengers?.length ? initialValue.passengers.map((passenger) => createPassenger(passenger)) : [createPassenger()],
  );
  const [segments, setSegments] = useState<SegmentState[]>(
    initialValue?.segments?.length ? initialValue.segments.map((segment) => createSegment(airports, segment)) : [createSegment(airports)],
  );

  const driverOptions = useMemo(
    () =>
      drivers.map((driver) => ({
        id: driver.id,
        label: driver.name,
        detail: [driver.phone, driver.airportCodes?.join(", ")].filter(Boolean).join(" · "),
      })),
    [drivers],
  );

  const airlineOptions = AIRLINE_OPTIONS.map((airline) => ({ id: airline, label: airline }));

  function updatePassenger(index: number, nextValue: Partial<PassengerDraft>) {
    setPassengers((current) => current.map((passenger, currentIndex) => (currentIndex === index ? { ...passenger, ...nextValue } : passenger)));
  }

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

  async function handleSubmit() {
    const invalidPassenger = passengers.find((passenger) => !passenger.firstName.trim() || !passenger.lastName.trim());
    const invalidSegment = segments.find(
      (segment) =>
        !segment.airline.trim() ||
        !segment.flightNumber.trim() ||
        !segment.departureAirport ||
        !segment.arrivalAirport ||
        !segment.departureTimeLocal ||
        !segment.arrivalTimeLocal,
    );

    if (!submitterName.trim()) {
      setMessage("Enter the submitter name.");
      return;
    }

    if (invalidPassenger) {
      setMessage("Complete every passenger before saving.");
      return;
    }

    if (invalidSegment) {
      setMessage("Complete every flight segment before saving.");
      return;
    }

    const payload =
      mode === "public"
        ? {
            submitterName: submitterName.trim(),
            submitterPhone: submitterPhone.trim() || null,
            notes: notes.trim() || null,
            passengers: passengers.map((passenger) => ({
              firstName: passenger.firstName.trim(),
              lastName: passenger.lastName.trim(),
              phone: passenger.phone.trim() || null,
              passengerType: passenger.passengerType,
            })),
            segments: segments.map((segment) => ({
              airline: segment.airline.trim(),
              flightNumber: segment.flightNumber.trim(),
              departureAirport: segment.departureAirport!.code,
              arrivalAirport: segment.arrivalAirport!.code,
              departureTimeLocal: segment.departureTimeLocal,
              arrivalTimeLocal: segment.arrivalTimeLocal,
            })),
          }
        : {
            notes: notes.trim() || null,
            passengers: passengers.map((passenger) => ({
              firstName: passenger.firstName.trim(),
              lastName: passenger.lastName.trim(),
              phone: passenger.phone.trim() || null,
              passengerType: passenger.passengerType,
            })),
            booking:
              bookingId.trim() || totalPrice.trim()
                ? {
                    confirmationNumber: bookingId.trim() || null,
                    totalCost: totalPrice.trim() ? Number(totalPrice) : null,
                  }
                : null,
            accommodation: accommodationNote.trim() ? { notes: accommodationNote.trim() } : null,
            segments: segments.map((segment, index) => ({
              segmentOrder: index + 1,
              airline: segment.airline.trim(),
              flightNumber: segment.flightNumber.trim(),
              departureAirportId: segment.departureAirport!.id,
              arrivalAirportId: segment.arrivalAirport!.id,
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error?.message ?? "Unable to save submission.");
      return;
    }

    setMessage(mode === "public" ? "Submission received." : "Itinerary created.");
    if (successPath) {
      startTransition(() => {
        router.push(successPath);
        router.refresh();
      });
    }
  }

  return (
    <section className="stack">
      {message ? (
        <div className="compact-card">
          <p>{message}</p>
        </div>
      ) : null}

      <Accordion
        type="multiple"
        defaultValue={mode === "public" ? ["submitter", "passengers", "segments"] : ["submitter", "passengers", "segments", "booking", "transport", "accommodation"]}
      >
        <AccordionItem value="submitter">
          <AccordionTrigger>
            <div>
              <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Submitter</strong>
              <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                Who sent these flight details
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span>Name</span>
                <input value={submitterName} onChange={(event) => setSubmitterName(event.target.value)} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={submitterPhone} onChange={(event) => setSubmitterPhone(event.target.value)} />
              </label>
            </div>
            <label className="field" style={{ marginTop: "0.75rem" }}>
              <span>{mode === "public" ? "Notes for admin review" : "Trip note"}</span>
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="passengers">
          <AccordionTrigger>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Passengers</strong>
                <p style={{ fontSize: "0.875rem", color: "var(--slate-500)", margin: "0.25rem 0 0 0" }}>
                  {passengers.length} passenger{passengers.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                className="button-secondary"
                type="button"
                style={{ marginRight: "2rem" }}
                onClick={(event) => {
                  event.stopPropagation();
                  setPassengers((current) => [...current, createPassenger()]);
                }}
              >
                Add passenger
              </button>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="stack">
              {passengers.map((passenger, index) => (
                <article key={passenger.id} className="compact-card" style={{ padding: "1rem" }}>
                  <div className="row-card__title">
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>
                      Passenger {index + 1}
                    </h3>
                    {passengers.length > 1 ? (
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => setPassengers((current) => current.filter((item) => item.id !== passenger.id))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field">
                      <span>First name</span>
                      <input value={passenger.firstName} onChange={(event) => updatePassenger(index, { firstName: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Last name</span>
                      <input value={passenger.lastName} onChange={(event) => updatePassenger(index, { lastName: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Phone</span>
                      <input value={passenger.phone} onChange={(event) => updatePassenger(index, { phone: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Passenger type</span>
                      <select value={passenger.passengerType} onChange={(event) => updatePassenger(index, { passengerType: event.target.value as PassengerDraft["passengerType"] })}>
                        <option value="WEST_SANTO">West Santo</option>
                        <option value="GUEST_SANTO">Guest Santo</option>
                        <option value="HARIBHAKTO">Haribhakto</option>
                        <option value="EXTRA_SEAT">Extra Seat</option>
                      </select>
                    </label>
                  </div>
                </article>
              ))}
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
                style={{ marginRight: "2rem" }}
                onClick={(event) => {
                  event.stopPropagation();
                  setSegments((current) => [...current, createSegment(airports)]);
                }}
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
                      <input value={segment.flightNumber} onChange={(event) => updateSegment(segment.id, { flightNumber: event.target.value })} />
                    </label>
                    <AirportAutocomplete
                      airports={airports}
                      label="Departure airport"
                      onSelect={(airport) => updateSegment(segment.id, { departureAirport: airport })}
                      value={segment.departureAirport}
                    />
                    <AirportAutocomplete
                      airports={airports}
                      label="Arrival airport"
                      onSelect={(airport) => updateSegment(segment.id, { arrivalAirport: airport })}
                      value={segment.arrivalAirport}
                    />
                    <label className="field">
                      <span>Departure time</span>
                      <input type="datetime-local" value={segment.departureTimeLocal} onChange={(event) => updateSegment(segment.id, { departureTimeLocal: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Arrival time</span>
                      <input type="datetime-local" value={segment.arrivalTimeLocal} onChange={(event) => updateSegment(segment.id, { arrivalTimeLocal: event.target.value })} />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {mode === "review" ? (
          <>
            <AccordionItem value="booking">
              <AccordionTrigger>
                <div>
                  <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Booking Details</strong>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field">
                    <span>Booking ID</span>
                    <input value={bookingId} onChange={(event) => setBookingId(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Total price</span>
                    <input type="number" min="0" step="0.01" value={totalPrice} onChange={(event) => setTotalPrice(event.target.value)} />
                  </label>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="transport">
              <AccordionTrigger>
                <div>
                  <strong style={{ fontSize: "1rem", color: "var(--slate-900)" }}>Pickup and Dropoff Details</strong>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="stack">
                  {segments.map((segment, index) => (
                    <article key={`${segment.id}-transport`} className="compact-card" style={{ padding: "1rem" }}>
                      <div className="row-card__title">
                        <div>
                          <p className="eyebrow">Segment {index + 1}</p>
                          <h3 style={{ margin: 0 }}>
                            {segment.departureAirport?.code ?? "DEP"} → {segment.arrivalAirport?.code ?? "ARR"}
                          </h3>
                        </div>
                      </div>
                      <TransportEntrySection
                        driverOptions={driverOptions}
                        entries={segment.pickupEntries}
                        label="Pickup entries"
                        onAdd={() => updateSegment(segment.id, { pickupEntries: [...segment.pickupEntries, createTransportEntry("PICKUP")] })}
                        onChange={(entryId, nextValue) => updateTransportEntry(segment.id, "PICKUP", entryId, nextValue)}
                        onRemove={(entryId) => updateSegment(segment.id, { pickupEntries: segment.pickupEntries.filter((entry) => entry.id !== entryId) })}
                      />
                      <TransportEntrySection
                        driverOptions={driverOptions}
                        entries={segment.dropoffEntries}
                        label="Dropoff entries"
                        onAdd={() => updateSegment(segment.id, { dropoffEntries: [...segment.dropoffEntries, createTransportEntry("DROPOFF")] })}
                        onChange={(entryId, nextValue) => updateTransportEntry(segment.id, "DROPOFF", entryId, nextValue)}
                        onRemove={(entryId) => updateSegment(segment.id, { dropoffEntries: segment.dropoffEntries.filter((entry) => entry.id !== entryId) })}
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
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <label className="field">
                  <span>Accommodation notes</span>
                  <textarea rows={3} value={accommodationNote} onChange={(event) => setAccommodationNote(event.target.value)} />
                </label>
              </AccordionContent>
            </AccordionItem>
          </>
        ) : null}
      </Accordion>

      <div className="actions-row" style={{ marginTop: "1.5rem" }}>
        <button disabled={isPending} type="button" onClick={() => void handleSubmit()}>
          {isPending ? "Saving..." : submitLabel}
        </button>
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
  driverOptions: Array<{ id: string; label: string; detail?: string }>;
  onAdd: () => void;
  onChange: (entryId: string, nextValue: Partial<TransportEntryState>) => void;
  onRemove: (entryId: string) => void;
}) {
  return (
    <div className="stack" style={{ marginTop: "1rem" }}>
      <div className="row-card__title">
        <h4 style={{ margin: 0, fontSize: "1rem" }}>{label}</h4>
        <button className="button-secondary" type="button" onClick={onAdd}>
          Add
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
          <DriverMultiSelect driverOptions={driverOptions} selectedIds={entry.driverIds} onChange={(driverIds) => onChange(entry.id, { driverIds })} />
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
  driverOptions: Array<{ id: string; label: string; detail?: string }>;
  selectedIds: string[];
  onChange: (driverIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedDrivers = driverOptions.filter((driver) => selectedIds.includes(driver.id));
  const availableDrivers = driverOptions.filter((driver) => !selectedIds.includes(driver.id));

  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
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
              {driver.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
