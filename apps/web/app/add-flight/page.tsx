import { listAirports, listMandirs, listPassengers } from "@west-santo/data";
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

  const [passengers, airports, mandirs] = await Promise.all([listPassengers(), listAirports(), listMandirs()]);

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Add Flight"
        tooltip="Create complete trip records with flight segments, passenger assignments, booking details, and accommodation"
      />
      <TripBuilder
        airports={airports.map((airport) => ({
          id: airport.id,
          label: airport.code,
          detail: [airport.name, airport.city].filter(Boolean).join(" · "),
        }))}
        mandirs={mandirs.map((mandir) => ({ id: mandir.id, name: mandir.name }))}
        passengers={passengers.map((passenger) => ({
          id: passenger.id,
          label: `${passenger.firstName} ${passenger.lastName}`,
          detail: passenger.phone ?? passenger.email ?? passenger.legalName ?? passenger.passengerType,
        }))}
      />
    </AppShell>
  );
}
