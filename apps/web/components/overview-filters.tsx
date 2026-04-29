"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AirportMultiSelect, type AirportChoice } from "@/components/airport-autocomplete";
import { SearchCombobox } from "@/components/search-combobox";

type PassengerOption = {
  id: string;
  label: string;
  detail?: string;
};

type OverviewFiltersProps = {
  previewRole?: string;
  passengers: PassengerOption[];
  airports: AirportChoice[];
  selectedPassengerIds: string[];
  selectedAirportIds: string[];
  clearHref: string;
};

export function OverviewFilters({
  previewRole,
  passengers,
  airports,
  selectedPassengerIds,
  selectedAirportIds,
  clearHref,
}: OverviewFiltersProps) {
  const [passengerQuery, setPassengerQuery] = useState("");
  const [selectedPassengers, setSelectedPassengers] = useState<PassengerOption[]>(() =>
    selectedPassengerIds
      .map((id) => passengers.find((passenger) => passenger.id === id))
      .filter((passenger): passenger is PassengerOption => Boolean(passenger)),
  );
  const selectedPassengerIdSet = useMemo(
    () => new Set(selectedPassengers.map((passenger) => passenger.id)),
    [selectedPassengers],
  );
  const availablePassengers = useMemo(
    () => passengers.filter((passenger) => !selectedPassengerIdSet.has(passenger.id)),
    [passengers, selectedPassengerIdSet],
  );

  useEffect(() => {
    setSelectedPassengers(
      selectedPassengerIds
        .map((id) => passengers.find((passenger) => passenger.id === id))
        .filter((passenger): passenger is PassengerOption => Boolean(passenger)),
    );
  }, [passengers, selectedPassengerIds]);

  return (
    <form action="/" className="dashboard-card overview-filter-card" method="GET">
      {previewRole ? <input name="previewRole" type="hidden" value={previewRole} /> : null}
      <div className="overview-filter-toolbar">
        <p className="eyebrow">Filters</p>
        <div className="actions-row overview-filter-toolbar__actions">
          <a className="button-secondary" href="/api/exports/trips">
            Export
          </a>
          <Link className="button-secondary" href="/add-flight">
            New itinerary
          </Link>
          <button className="button-secondary" type="submit">
            Apply filters
          </button>
          <a className="button-secondary" href={clearHref}>
            Clear
          </a>
        </div>
      </div>
      <div className="detail-grid overview-filter-grid">
        <div className="field">
          <span>Passenger filter</span>
          <div className="stack stack--tight">
            <SearchCombobox
              clearOnSelect
              emptyState="No passengers found."
              hideLabel
              label="Passenger filter"
              onSelect={(option) => {
                setSelectedPassengers((current) =>
                  current.some((passenger) => passenger.id === option.id) ? current : [...current, option],
                );
              }}
              onValueChange={setPassengerQuery}
              options={availablePassengers}
              placeholder="Search and add passengers"
              value={passengerQuery}
            />
            {selectedPassengers.length > 0 ? (
              <div className="chip-row">
                {selectedPassengers.map((passenger) => (
                  <button
                    className="chip"
                    key={passenger.id}
                    onClick={() =>
                      setSelectedPassengers((current) => current.filter((item) => item.id !== passenger.id))
                    }
                    type="button"
                  >
                    {passenger.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-inline">All passengers</p>
            )}
            {selectedPassengers.map((passenger) => (
              <input key={passenger.id} name="passengerId" type="hidden" value={passenger.id} />
            ))}
          </div>
        </div>

        <AirportMultiSelect
          airports={airports}
          emptyMessage="All airports"
          label="Airport filter"
          name="airportId"
          placeholder="Search and add airports"
          selectedIds={selectedAirportIds}
        />
      </div>
    </form>
  );
}
