import { listDrivers, listTransportTasks } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TransportTaskBoard } from "@/components/transport-task-board";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function TransportTasksPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }

  const [tasks, drivers] = await Promise.all([listTransportTasks(), listDrivers()]);

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Transport Tasks"
        tooltip="Assign drivers, track status, and monitor pickup and drop-off execution"
      />
      <TransportTaskBoard
        drivers={drivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          airportCodes: driver.driverAirports.map((entry) => entry.airport.code),
        }))}
        tasks={tasks}
      />
    </AppShell>
  );
}
