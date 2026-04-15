import type { ReactNode } from "react";

interface CompactCardProps {
  children: ReactNode;
  variant?: "default" | "highlighted" | "interactive";
  className?: string;
  onClick?: () => void;
}

export function CompactCard({
  children,
  variant = "default",
  className = "",
  onClick,
}: CompactCardProps) {
  const Component = onClick ? "button" : "div";

  const variantClasses = {
    default: "compact-card",
    highlighted: "compact-card compact-card--highlighted",
    interactive: "compact-card compact-card--interactive",
  };

  return (
    <Component
      className={`${variantClasses[variant]} ${className}`}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {children}
    </Component>
  );
}
