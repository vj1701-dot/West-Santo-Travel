import { listPassengerReports, listTripReports } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { AdminExportConsole } from "@/components/admin-export-console";
import { PageHeader } from "@/components/page-header";
import { ReportsConsole } from "@/components/reports-console";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const currentUser = await requireRole("ADMIN");
  const [tripReports, passengerReports] = await Promise.all([listTripReports(), listPassengerReports()]);

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Trip and passenger cost reporting with refunds, plus operational exports."
        tooltip="Admin-only reporting area for trip cost, refunds, passenger expense totals, and exports"
      />
      <ReportsConsole passengerReports={passengerReports} tripReports={tripReports} />
      <AdminExportConsole />
    </AppShell>
  );
}
