import Link from "next/link";

import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default function AccessDeniedPage() {
  return (
    <AppShell>
      <div className="panel" style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <LockIcon />
        </div>
        <h1 style={{ fontSize: "1.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>
          Access Denied
        </h1>
        <p style={{ color: "var(--slate-600)", marginBottom: "1.5rem", lineHeight: "1.6" }}>
          Your account is not enabled for this application. You may be authenticated but not provisioned locally, inactive, or missing the required role.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="pill" href="/sign-in" style={{ display: "inline-block", textDecoration: "none" }}>
            Sign In
          </Link>
          <Link className="button-secondary" href="/sign-up" style={{ display: "inline-block", textDecoration: "none" }}>
            Sign Up
          </Link>
          <Link className="button-secondary" href="/" style={{ display: "inline-block", textDecoration: "none" }}>
            Return Home
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function LockIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ margin: "0 auto", color: "var(--indigo-600)" }}
    >
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}
