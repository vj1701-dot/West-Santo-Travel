"use client";

import Fuse from "fuse.js";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type AirportChoice = {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  country?: string | null;
};

type AirportAutocompleteProps = {
  airports: AirportChoice[];
  label: string;
  value: AirportChoice | null;
  onSelect: (airport: AirportChoice) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  clearOnSelect?: boolean;
};

type AirportMultiSelectProps = {
  airports: AirportChoice[];
  label: string;
  name: string;
  selectedIds?: string[];
  disabled?: boolean;
  onChange?: (selectedIds: string[]) => void;
};

const MAX_RESULTS = 8;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function formatAirportLabel(airport: AirportChoice) {
  return `${airport.code} — ${airport.name}, ${airport.city || "Unknown city"}, ${airport.country || "Unknown country"}`;
}

function createAirportSearch(airports: AirportChoice[]) {
  const fuse = new Fuse(airports, {
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    keys: [
      { name: "code", weight: 3 },
      { name: "city", weight: 2 },
      { name: "name", weight: 1.5 },
    ],
  });

  function rank(airport: AirportChoice, query: string) {
    const code = normalize(airport.code);
    const city = normalize(airport.city ?? "");
    const name = normalize(airport.name);

    if (code === query) return 0;
    if (city.startsWith(query)) return 1;
    if (name.includes(query)) return 2;
    return 3;
  }

  return (query: string) => {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return airports.slice(0, MAX_RESULTS);
    }

    return fuse
      .search(normalizedQuery, { limit: 50 })
      .sort((left, right) => {
        const leftRank = rank(left.item, normalizedQuery);
        const rightRank = rank(right.item, normalizedQuery);

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        const leftScore = left.score ?? Number.POSITIVE_INFINITY;
        const rightScore = right.score ?? Number.POSITIVE_INFINITY;

        if (leftScore !== rightScore) {
          return leftScore - rightScore;
        }

        return left.item.code.localeCompare(right.item.code);
      })
      .slice(0, MAX_RESULTS)
      .map((result) => result.item);
  };
}

export function AirportAutocomplete({
  airports,
  label,
  value,
  onSelect,
  placeholder = "Search airports by code, city, or name",
  disabled,
  error,
  clearOnSelect = false,
}: AirportAutocompleteProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const inputId = useId();
  const [query, setQuery] = useState(value?.code ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchAirports = useMemo(() => createAirportSearch(airports), [airports]);
  const results = useMemo(() => searchAirports(query), [query, searchAirports]);

  useEffect(() => {
    setQuery(value?.code ?? "");
  }, [value?.id, value?.code]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const activeOption = results[activeIndex] ?? null;

  return (
    <label className="field">
      <span>{label}</span>
      <div className="airport-combobox" ref={rootRef}>
        <input
          aria-activedescendant={isOpen && activeOption ? `${listboxId}-${activeOption.id}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-invalid={error ? true : undefined}
          aria-label={label}
          autoComplete="off"
          className="airport-combobox__input"
          disabled={disabled}
          id={inputId}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => (results.length === 0 ? 0 : (current + 1) % results.length));
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => (results.length === 0 ? 0 : (current - 1 + results.length) % results.length));
            }

            if (event.key === "Enter" && activeOption) {
              event.preventDefault();
              onSelect(activeOption);
              setQuery(clearOnSelect ? "" : activeOption.code);
              setIsOpen(false);
            }

            if (event.key === "Escape") {
              setQuery(value?.code ?? "");
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={query}
        />
        {isOpen ? (
          <div className="airport-combobox__menu" role="presentation">
            <ul aria-label={`${label} suggestions`} className="airport-combobox__list" id={listboxId} role="listbox">
              {results.length > 0 ? (
                results.map((airport, index) => (
                  <li
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "airport-combobox__option airport-combobox__option--active" : "airport-combobox__option"}
                    id={`${listboxId}-${airport.id}`}
                    key={airport.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(airport);
                      setQuery(clearOnSelect ? "" : airport.code);
                      setIsOpen(false);
                    }}
                    role="option"
                  >
                    {formatAirportLabel(airport)}
                  </li>
                ))
              ) : (
                <li className="airport-combobox__empty" role="status">
                  No airports found.
                </li>
              )}
            </ul>
          </div>
        ) : null}
      </div>
      {error ? <small className="airport-combobox__error">{error}</small> : null}
    </label>
  );
}

export function AirportMultiSelect({ airports, label, name, selectedIds = [], disabled, onChange }: AirportMultiSelectProps) {
  const [selectedAirports, setSelectedAirports] = useState<AirportChoice[]>(() =>
    selectedIds.map((id) => airports.find((airport) => airport.id === id)).filter((airport): airport is AirportChoice => Boolean(airport)),
  );
  const selectedIdSet = useMemo(() => new Set(selectedAirports.map((airport) => airport.id)), [selectedAirports]);
  const availableAirports = useMemo(
    () => airports.filter((airport) => !selectedIdSet.has(airport.id)),
    [airports, selectedIdSet],
  );

  useEffect(() => {
    setSelectedAirports(
      selectedIds.map((id) => airports.find((airport) => airport.id === id)).filter((airport): airport is AirportChoice => Boolean(airport)),
    );
  }, [airports, selectedIds.join("|")]);

  return (
    <div className="field">
      <span>{label}</span>
      <div className="stack stack--tight">
        <AirportAutocomplete
          airports={availableAirports}
          disabled={disabled}
          label={label}
          onSelect={(airport) =>
            setSelectedAirports((current) => {
              const next = current.some((item) => item.id === airport.id) ? current : [...current, airport];
              onChange?.(next.map((item) => item.id));
              return next;
            })
          }
          placeholder="Add airport access"
          clearOnSelect
          value={null}
        />
        {selectedAirports.length > 0 ? (
          <div className="chip-row">
            {selectedAirports.map((airport) => (
              <button
                className="chip"
                key={airport.id}
                onClick={() =>
                  setSelectedAirports((current) => {
                    const next = current.filter((item) => item.id !== airport.id);
                    onChange?.(next.map((item) => item.id));
                    return next;
                  })
                }
                type="button"
              >
                {airport.code}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted-inline">No airports selected.</p>
        )}
        {selectedAirports.map((airport) => (
          <input key={airport.id} name={name} type="hidden" value={airport.id} />
        ))}
      </div>
    </div>
  );
}
