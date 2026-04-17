import { listAirports, listDrivers, listPassengers, listUsers } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TripBuilder } from "@/components/trip-builder";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AddFlightPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }

  const [passengers, airports, drivers, users] = await Promise.all([listPassengers(), listAirports(), listDrivers(), listUsers()]);

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Add Flight"
        tooltip="Create complete trip records with flight segments, passenger assignments, booking details, and accommodation"
      />
      <TripBuilder
        drivers={drivers.map((driver: typeof drivers[number]) => ({
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          notes: driver.notes,
          airportCodes: driver.driverAirports.map((entry) => entry.airport.code),
        }))}
        airports={airports.map((airport) => ({
          id: airport.id,
          code: airport.code,
          name: airport.name,
          city: airport.city,
          country: airport.country,
        }))}
        passengers={passengers.map((passenger) => ({
          id: passenger.id,
          label: `${passenger.firstName} ${passenger.lastName}`,
          detail: passenger.phone ?? passenger.email ?? passenger.legalName ?? passenger.passengerType,
        }))}
        users={users.map((user) => ({
          id: user.id,
          label: `${user.firstName} ${user.lastName}`.trim() || user.email,
          detail: [user.role, user.email, user.phone].filter(Boolean).join(" · "),
        }))}
        submitLabel="Save trip"
        successPath="/itineraries"
      />
    </AppShell>
  );
}
