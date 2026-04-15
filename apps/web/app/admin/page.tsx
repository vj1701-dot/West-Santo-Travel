import { AppShell } from "@/components/app-shell";
import { AdminExportConsole } from "@/components/admin-export-console";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const currentUser = await requireRole("ADMIN");

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Administration"
        tooltip="Admin-only area for data exports and system-level operations"
      />
      <AdminExportConsole />
    </AppShell>
  );
}
