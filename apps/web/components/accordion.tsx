"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AccordionContextValue {
  openItems: Set<string>;
  toggleItem: (value: string) => void;
  type: "single" | "multiple";
}

const AccordionContext = createContext<AccordionContextValue | null>(null);
const AccordionItemContext = createContext<string | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within an Accordion provider");
  }
  return context;
}

interface AccordionProps {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  children: ReactNode;
  className?: string;
}

export function Accordion({
  type = "multiple",
  defaultValue = [],
  children,
  className = "",
}: AccordionProps) {
  const initialItems = new Set(
    Array.isArray(defaultValue) ? defaultValue : [defaultValue]
  );
  const [openItems, setOpenItems] = useState<Set<string>>(initialItems);

  const toggleItem = (value: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (type === "single") {
          next.clear();
        }
        next.add(value);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggleItem, type }}>
      <div className={`accordion-root ${className}`}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: ReactNode;
}

export function AccordionItem({ value, children }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className="accordion-item">{children}</div>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps {
  children: ReactNode;
  value?: string;
}

export function AccordionTrigger({ children, value }: AccordionTriggerProps) {
  const { openItems, toggleItem } = useAccordionContext();
  const itemValue = value ?? useContext(AccordionItemContext);
  if (!itemValue) {
    throw new Error("AccordionTrigger requires a value or AccordionItem parent.");
  }
  const isOpen = openItems.has(itemValue);

  return (
    <button
      type="button"
      className="accordion-trigger"
      onClick={() => toggleItem(itemValue)}
      aria-expanded={isOpen}
    >
      <span>{children}</span>
      <span className="accordion-trigger-icon">
        <ChevronDownIcon />
      </span>
    </button>
  );
}

interface AccordionContentProps {
  children: ReactNode;
  value?: string;
}

export function AccordionContent({ children, value }: AccordionContentProps) {
  const { openItems } = useAccordionContext();
  const itemValue = value ?? useContext(AccordionItemContext);
  if (!itemValue) {
    throw new Error("AccordionContent requires a value or AccordionItem parent.");
  }
  const isOpen = openItems.has(itemValue);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="accordion-content">
      <div className="accordion-content-inner">{children}</div>
    </div>
  );
}

// Simple chevron down icon component
function ChevronDownIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
