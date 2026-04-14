"use client";

import { useState } from "react";

type PassengerDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  passengerType: "WEST_SANTO" | "GUEST_SANTO" | "HARIBHAKTO" | "EXTRA_SEAT";
};

type SegmentDraft = {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
};

const emptyPassenger = (): PassengerDraft => ({
  firstName: "",
  lastName: "",
  phone: "",
  passengerType: "WEST_SANTO",
});

const emptySegment = (): SegmentDraft => ({
  airline: "",
  flightNumber: "",
  departureAirport: "",
  arrivalAirport: "",
  departureTimeLocal: "",
  arrivalTimeLocal: "",
});

export function PublicSubmissionForm() {
  const [submitterName, setSubmitterName] = useState("");
  const [submitterPhone, setSubmitterPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [passengers, setPassengers] = useState<PassengerDraft[]>([emptyPassenger()]);
  const [segments, setSegments] = useState<SegmentDraft[]>([emptySegment()]);
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    try {
      const response = await fetch("/api/public-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterName,
          submitterPhone: submitterPhone || null,
          notes: notes || null,
          passengers: passengers.map((passenger) => ({
            ...passenger,
            phone: passenger.phone || null,
          })),
          segments,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Submission failed.");
      }

      setStatus(payload.data?.message ?? "Submission received.");
      setSubmitterName("");
      setSubmitterPhone("");
      setNotes("");
      setPassengers([emptyPassenger()]);
      setSegments([emptySegment()]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      {status ? <div className="panel"><strong>{status}</strong></div> : null}

      <div className="panel-head">
        <div>
          <p className="eyebrow">Submitter</p>
          <h2>Who is sending this itinerary?</h2>
        </div>
      </div>

      <div className="admin-form">
        <input value={submitterName} onChange={(event) => setSubmitterName(event.target.value)} placeholder="Your name" required />
        <input value={submitterPhone} onChange={(event) => setSubmitterPhone(event.target.value)} placeholder="Your phone" />
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for admin review" />
      </div>

      <div className="panel-head">
        <div>
          <p className="eyebrow">Passengers</p>
          <h2>Traveler details</h2>
        </div>
        <button type="button" onClick={() => setPassengers((current) => [...current, emptyPassenger()])}>Add passenger</button>
      </div>

      <div className="stack">
        {passengers.map((passenger, index) => (
          <div key={`passenger-${index}`} className="row-card">
            <div className="admin-grid">
              <input
                value={passenger.firstName}
                onChange={(event) => setPassengers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, firstName: event.target.value } : item))}
                placeholder="First name"
                required
              />
              <input
                value={passenger.lastName}
                onChange={(event) => setPassengers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, lastName: event.target.value } : item))}
                placeholder="Last name"
                required
              />
              <input
                value={passenger.phone}
                onChange={(event) => setPassengers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, phone: event.target.value } : item))}
                placeholder="Phone"
              />
              <select
                value={passenger.passengerType}
                onChange={(event) => setPassengers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, passengerType: event.target.value as PassengerDraft["passengerType"] } : item))}
              >
                <option value="WEST_SANTO">West Santo</option>
                <option value="GUEST_SANTO">Guest Santo</option>
                <option value="HARIBHAKTO">Haribhakto</option>
                <option value="EXTRA_SEAT">Extra Seat</option>
              </select>
              {passengers.length > 1 ? (
                <button type="button" onClick={() => setPassengers((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-head">
        <div>
          <p className="eyebrow">Flight Segments</p>
          <h2>All legs of the trip</h2>
        </div>
        <button type="button" onClick={() => setSegments((current) => [...current, emptySegment()])}>Add segment</button>
      </div>

      <div className="stack">
        {segments.map((segment, index) => (
          <div key={`segment-${index}`} className="row-card">
            <div className="admin-grid">
              <input
                value={segment.airline}
                onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, airline: event.target.value } : item))}
                placeholder="Airline"
                required
              />
              <input
                value={segment.flightNumber}
                onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, flightNumber: event.target.value } : item))}
                placeholder="Flight number"
                required
              />
              <input
                value={segment.departureAirport}
                onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, departureAirport: event.target.value } : item))}
                placeholder="Departure airport"
                required
              />
              <input
                value={segment.arrivalAirport}
                onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, arrivalAirport: event.target.value } : item))}
                placeholder="Arrival airport"
                required
              />
              <input
                value={segment.departureTimeLocal}
                onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, departureTimeLocal: event.target.value } : item))}
                type="datetime-local"
                required
              />
              <input
                value={segment.arrivalTimeLocal}
                onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, arrivalTimeLocal: event.target.value } : item))}
                type="datetime-local"
                required
              />
              {segments.length > 1 ? (
                <button type="button" onClick={() => setSegments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <button disabled={isSubmitting} type="submit">{isSubmitting ? "Submitting..." : "Submit for review"}</button>
    </form>
  );
}
