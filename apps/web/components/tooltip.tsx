"use client";

import { useState, type ReactNode } from "react";

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({
  content,
  children,
  placement = "top",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      className="tooltip-trigger"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      style={{ position: "relative" }}
    >
      {children}
      {isVisible && (
        <span
          className="tooltip-content"
          style={getPositionStyles(placement)}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}

function getPositionStyles(placement: string): React.CSSProperties {
  switch (placement) {
    case "top":
      return {
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "bottom":
      return {
        top: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        right: "calc(100% + 8px)",
        top: "50%",
        transform: "translateY(-50%)",
      };
    case "right":
      return {
        left: "calc(100% + 8px)",
        top: "50%",
        transform: "translateY(-50%)",
      };
    default:
      return {};
  }
}

// Info icon component
export function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block ${className}`}
      style={{ color: "var(--slate-400)" }}
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 11V7.5M8 5H8.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
