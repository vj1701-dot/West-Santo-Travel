"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock3, Plane } from "lucide-react";

type CalendarFlight = {
  id: string;
  airline: string;
  flightNumber: string;
  route: string;
  status: string;
  departureAirportCode: string;
  departureAirportName: string;
  arrivalAirportCode: string;
  departureTimeUtc: string;
  arrivalTimeUtc: string;
};

type ViewMode = "today" | "tomorrow" | "week";

const hourTicks = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
const dayStartHour = 6;
const dayEndHour = 24;
const dayWindowMinutes = (dayEndHour - dayStartHour) * 60;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function minutesFromWindowStart(value: Date) {
  return value.getHours() * 60 + value.getMinutes() - dayStartHour * 60;
}

function percentFromMinutes(minutes: number) {
  return Math.min(100, Math.max(0, (minutes / dayWindowMinutes) * 100));
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatTick(hour: number) {
  if (hour === 24) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function getStatusClass(status: string) {
  if (status === "CANCELLED") return "cancelled";
  if (status === "PENDING_APPROVAL" || status === "CREATED") return "pending";
  return "confirmed";
}

function buildAirportName(name: string) {
  return name.replace(/\s+(International|Airport)$/i, "").replace(/\bIntl\b/i, "Intl");
}

export function FlightCalendarTimeline({
  flights,
  nowIso,
}: {
  flights: CalendarFlight[];
  nowIso: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [now, setNow] = useState(() => new Date(nowIso));
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const actualToday = startOfDay(now);
  const flightDays = useMemo(
    () =>
      Array.from(
        new Set(
          flights
            .map((flight) => startOfDay(new Date(flight.departureTimeUtc)).getTime())
            .sort((a, b) => a - b),
        ),
      ),
    [flights],
  );
  const hasFlightsToday = flightDays.includes(actualToday.getTime());
  const baseDay = new Date(hasFlightsToday || flightDays.length === 0 ? actualToday.getTime() : flightDays[0]);
  const selectedDate = viewMode === "tomorrow" ? addDays(baseDay, 1) : baseDay;
  const visibleFlights = useMemo(() => {
    return flights
      .map((flight) => ({
        ...flight,
        departure: new Date(flight.departureTimeUtc),
        arrival: new Date(flight.arrivalTimeUtc),
      }))
      .filter((flight) => {
        if (viewMode === "week") {
          const departureDay = startOfDay(flight.departure);
          return departureDay >= baseDay && departureDay < addDays(baseDay, 7);
        }

        return isSameDay(flight.departure, selectedDate);
      })
      .sort((a, b) => a.departure.getTime() - b.departure.getTime());
  }, [baseDay, flights, selectedDate, viewMode]);

  const lanes = useMemo(() => {
    const laneMap = new Map<string, { code: string; name: string }>();
    for (const flight of visibleFlights) {
      laneMap.set(flight.departureAirportCode, {
        code: flight.departureAirportCode,
        name: buildAirportName(flight.departureAirportName),
      });
    }

    return Array.from(laneMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [visibleFlights]);

  const selectedFlight = visibleFlights.find((flight) => flight.id === selectedFlightId) ?? null;
  const showNowMarker =
    hasFlightsToday && viewMode === "today" && now.getHours() >= dayStartHour && now.getHours() <= dayEndHour;
  const nowLeft = percentFromMinutes(minutesFromWindowStart(now));

  return (
    <section className="flight-calendar" aria-label="Flight calendar timeline">
      <div className="flight-calendar__header">
        <div>
          <div className="flight-calendar__title-row">
            <h3>Today&apos;s flights</h3>
            <span>{formatDateLabel(selectedDate)} - {visibleFlights.length} segments</span>
          </div>
        </div>
        <div className="flight-calendar__controls">
          <span className="flight-calendar__live">
            <span />
            Live
          </span>
          <div className="flight-calendar__tabs" role="tablist" aria-label="Calendar range">
            {[
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
              ["week", "Week"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={viewMode === value}
                className={viewMode === value ? "active" : ""}
                onClick={() => {
                  setViewMode(value as ViewMode);
                  setSelectedFlightId(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flight-calendar__body">
        <div className="flight-calendar__lane-labels" style={{ gridRow: `2 / span ${Math.max(lanes.length, 1)}` }}>
          {lanes.length > 0 ? (
            lanes.map((lane) => (
              <div key={lane.code} className="flight-calendar__airport">
                <strong>{lane.code}</strong>
                <span>{lane.name}</span>
              </div>
            ))
          ) : (
            <div className="flight-calendar__airport">
              <strong>--</strong>
              <span>No flights</span>
            </div>
          )}
        </div>

        <div className="flight-calendar__time-head">
          {hourTicks.map((hour) => (
            <span key={hour} style={{ left: `${percentFromMinutes((hour - dayStartHour) * 60)}%` }}>
              {formatTick(hour)}
            </span>
          ))}
        </div>

        <div
          className="flight-calendar__grid"
          style={{ gridTemplateRows: `repeat(${Math.max(lanes.length, 1)}, 112px)` }}
        >
          {lanes.length > 0 ? lanes.map((lane) => <div key={lane.code} className="flight-calendar__lane" />) : <div className="flight-calendar__lane" />}

          {showNowMarker ? (
            <div className="flight-calendar__now" style={{ left: `${nowLeft}%` }}>
              <span>NOW</span>
            </div>
          ) : null}

          {visibleFlights.map((flight) => {
            const laneIndex = lanes.findIndex((lane) => lane.code === flight.departureAirportCode);
            const departure = viewMode === "week" ? new Date(flight.departure) : flight.departure;
            const arrival = viewMode === "week" ? new Date(flight.arrival) : flight.arrival;
            const left = percentFromMinutes(minutesFromWindowStart(departure));
            const right = percentFromMinutes(minutesFromWindowStart(arrival));
            const width = Math.max(8, right - left);
            const isSelected = selectedFlightId === flight.id;

            return (
              <button
                key={flight.id}
                type="button"
                className={`flight-calendar__block ${getStatusClass(flight.status)}${isSelected ? " selected" : ""}`}
                style={{
                  gridRow: Math.max(1, laneIndex + 1),
                  left: `${left}%`,
                  width: `${width}%`,
                }}
                title={`${flight.flightNumber} ${flight.route}`}
                onClick={() => setSelectedFlightId(isSelected ? null : flight.id)}
              >
                <span>{flight.flightNumber}</span>
                <strong>{flight.route}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flight-calendar__footer">
        {selectedFlight ? (
          <div className="flight-calendar__details">
            <Plane size={16} />
            <strong>{selectedFlight.flightNumber}</strong>
            <span>{selectedFlight.route}</span>
            <span>{selectedFlight.airline}</span>
            <span>{selectedFlight.status.replace(/_/g, " ")}</span>
            <span>
              {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(selectedFlight.departure)}
              {" - "}
              {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(selectedFlight.arrival)}
            </span>
          </div>
        ) : (
          <div className="flight-calendar__details muted">
            <Clock3 size={16} />
            <span>Select a flight block for details</span>
          </div>
        )}
        <ChevronDown size={16} className="flight-calendar__footer-icon" />
      </div>
    </section>
  );
}
