import { listAirports, listDrivers } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DriverManager } from "@/components/driver-manager";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }
  const [drivers, airports] = await Promise.all([listDrivers(), listAirports()]);

  return (
    <AppShell currentUser={currentUser}>
      <DriverManager
        airports={airports.map((airport) => ({ id: airport.id, code: airport.code, name: airport.name }))}
        drivers={drivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          notes: driver.notes,
          telegramChatId: driver.telegramChatId,
          telegramUsername: driver.telegramUsername,
          airportIds: driver.driverAirports.map((assignment) => assignment.airportId),
          airportCodes: driver.driverAirports.map((assignment) => assignment.airport.code),
        }))}
      />
    </AppShell>
  );
}
