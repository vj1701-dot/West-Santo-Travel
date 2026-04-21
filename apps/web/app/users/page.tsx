import { listAirports, listUsers } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { UserManager } from "@/components/user-manager";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }
  const [users, airports] = await Promise.all([listUsers(), listAirports()]);

  return (
    <AppShell currentUser={currentUser}>
      <UserManager
        airports={airports.map((airport) => ({
          id: airport.id,
          code: airport.code,
          name: airport.name,
          city: airport.city,
          country: airport.country,
        }))}
        users={users.map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          telegramChatId: user.telegramChatId,
          telegramUsername: user.telegramUsername,
          airportIds: [...user.adminAirports, ...user.coordinatorAirports].map((assignment) => assignment.airportId),
          airportCodes: [...user.adminAirports, ...user.coordinatorAirports].map((assignment) => assignment.airport.code),
          identityProvider: user.identityProvider,
          identityLinkedAt: user.identityLinkedAt?.toISOString() ?? null,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          linkedPassengerName:
            user.passengerUserLinks
              ? `${user.passengerUserLinks.passenger.firstName} ${user.passengerUserLinks.passenger.lastName}`
              : null,
        }))}
      />
    </AppShell>
  );
}
