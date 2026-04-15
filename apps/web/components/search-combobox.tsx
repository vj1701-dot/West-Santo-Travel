"use client";

import Fuse from "fuse.js";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type SearchOption = {
  id: string;
  label: string;
  detail?: string;
};

type SearchComboboxProps = {
  label: string;
  options: SearchOption[];
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (option: SearchOption) => void;
  placeholder?: string;
  disabled?: boolean;
  clearOnSelect?: boolean;
};

const MAX_RESULTS = 8;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function SearchCombobox({
  label,
  options,
  value,
  onValueChange,
  onSelect,
  placeholder,
  disabled,
  clearOnSelect = false,
}: SearchComboboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const fuse = useMemo(
    () =>
      new Fuse(options, {
        includeScore: true,
        threshold: 0.35,
        ignoreLocation: true,
        keys: [
          { name: "label", weight: 3 },
          { name: "detail", weight: 1.5 },
        ],
      }),
    [options],
  );

  const results = useMemo(() => {
    const query = normalize(value);
    if (!query) {
      return options.slice(0, MAX_RESULTS);
    }

    const prefixMatches = options.filter((option) => normalize(option.label).startsWith(query));
    const fuzzyMatches = fuse
      .search(query, { limit: 30 })
      .map((result) => result.item)
      .filter((option) => !prefixMatches.some((prefix) => prefix.id === option.id));

    return [...prefixMatches, ...fuzzyMatches].slice(0, MAX_RESULTS);
  }, [fuse, options, value]);

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
  }, [value]);

  const activeOption = results[activeIndex] ?? null;

  function selectOption(option: SearchOption) {
    onSelect(option);
    onValueChange(clearOnSelect ? "" : option.label);
    setIsOpen(false);
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="airport-combobox" ref={rootRef}>
        <input
          id={inputId}
          aria-activedescendant={isOpen && activeOption ? `${listboxId}-${activeOption.id}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-label={label}
          autoComplete="off"
          className="airport-combobox__input"
          disabled={disabled}
          onChange={(event) => {
            onValueChange(event.target.value);
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
              selectOption(activeOption);
            }

            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={value}
        />
        {isOpen ? (
          <div className="airport-combobox__menu" role="presentation">
            <ul aria-label={`${label} suggestions`} className="airport-combobox__list" id={listboxId} role="listbox">
              {results.length > 0 ? (
                results.map((option, index) => (
                  <li
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "airport-combobox__option airport-combobox__option--active" : "airport-combobox__option"}
                    id={`${listboxId}-${option.id}`}
                    key={option.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option);
                    }}
                    role="option"
                  >
                    <div className="stack stack--tight" style={{ gap: "0.15rem" }}>
                      <strong style={{ fontSize: "0.9rem", color: "var(--slate-800)" }}>{option.label}</strong>
                      {option.detail ? <span style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>{option.detail}</span> : null}
                    </div>
                  </li>
                ))
              ) : (
                <li className="airport-combobox__empty" role="status">
                  No matches found.
                </li>
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </label>
  );
}
