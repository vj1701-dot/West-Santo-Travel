import { listPassengers } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PassengerManager } from "@/components/passenger-manager";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PassengersPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }
  const passengers = await listPassengers();

  return (
    <AppShell currentUser={currentUser}>
      <PassengerManager
        passengers={passengers.map((passenger) => ({
          id: passenger.id,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          legalName: passenger.legalName,
          email: passenger.email,
          phone: passenger.phone,
          passengerType: passenger.passengerType,
          notes: passenger.notes,
          telegramChatId: passenger.telegramChatId,
          telegramUsername: passenger.telegramUsername,
          itineraryCount: passenger.itineraryPassengers.length,
        }))}
      />
    </AppShell>
  );
}
