import type { ReactNode } from "react";
import { Tooltip, InfoIcon } from "./tooltip";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  tooltip?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, eyebrow, description, tooltip, actions, className = "" }: Props) {
  return (
    <section className={`page-header ${className}`}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "600", margin: 0 }}>{title}</h1>
            {tooltip && (
              <Tooltip content={tooltip}>
                <InfoIcon />
              </Tooltip>
            )}
          </div>
          {description ? <p className="lead">{description}</p> : null}
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </section>
  );
}
