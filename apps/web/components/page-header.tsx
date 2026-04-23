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
    <section className={`page-header ${className}`.trim()}>
      <div className="page-header__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1>{title}</h1>
          {tooltip ? (
            <Tooltip content={tooltip}>
              <InfoIcon />
            </Tooltip>
          ) : null}
        </div>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </section>
  );
}
