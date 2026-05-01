import Link from "next/link";
import type { PropsWithChildren } from "react";

type LegalPageLayoutProps = PropsWithChildren<{
  title: string;
  description: string;
  lastUpdated: string;
}>;

export function LegalPageLayout({ title, description, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <main className="public-shell legal-shell">
      <section className="public-hero legal-hero">
        <p className="eyebrow">Public Legal Page</p>
        <h1>{title}</h1>
        <p className="legal-lead">{description}</p>
        <div className="legal-nav">
          <Link className="button-secondary" href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className="button-secondary" href="/terms-and-conditions">
            Terms & Conditions
          </Link>
          <Link className="button-secondary" href="/submission">
            Submit Flight Details
          </Link>
        </div>
        <p className="notes">Last updated: {lastUpdated}</p>
      </section>
      <article className="legal-card">{children}</article>
    </main>
  );
}
