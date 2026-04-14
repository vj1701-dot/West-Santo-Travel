import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { LoginButton } from "@/components/login-button";
import { PageHeader } from "@/components/page-header";

export default function AccessDeniedPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Access"
        title="Access denied"
        description="Your account is not enabled for this application. Contact an admin."
      />
      <div className="panel">
        <p className="lead">You may be authenticated in Keycloak but not provisioned locally, inactive, or missing the required role.</p>
        <div className="row-meta" style={{ marginTop: "1rem" }}>
          <LoginButton />
          <Link className="pill" href="/">Return home</Link>
        </div>
      </div>
    </AppShell>
  );
}
