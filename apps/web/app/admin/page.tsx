import { listAirports, listDrivers, listItineraries, listPassengers, listPublicSubmissions, listTransportTasks, listUsers } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { AdminConsole } from "@/components/admin-console";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const currentUser = await requireRole("ADMIN");
  const [users, passengers, itineraries, airports, publicSubmissions, transportTasks, drivers] = await Promise.all([
    listUsers(),
    listPassengers(),
    listItineraries(),
    listAirports(),
    listPublicSubmissions(),
    listTransportTasks(),
    listDrivers(),
  ]);

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Admin"
        title="Edit operational data from the frontend"
        description="Manage users, passengers, itineraries, and flight segments directly in the web app instead of editing the database manually."
      />
      <AdminConsole
        airports={airports}
        itineraries={itineraries.map((itinerary) => ({
          id: itinerary.id,
          notes: itinerary.notes,
          status: itinerary.status,
          passengerNames: itinerary.itineraryPassengers.map((item) => `${item.passenger.firstName} ${item.passenger.lastName}`).join(", "),
          segmentCount: itinerary.flightSegments.length,
        }))}
        passengers={passengers.map((passenger) => ({
          id: passenger.id,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          legalName: passenger.legalName,
          email: passenger.email,
          phone: passenger.phone,
          passengerType: passenger.passengerType,
          notes: passenger.notes,
        }))}
        users={users.map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
        }))}
        publicSubmissions={publicSubmissions.map((submission) => ({
          id: submission.id,
          status: submission.status,
          createdAt: submission.createdAt.toISOString(),
          notes: submission.notes,
          passengerCount: Array.isArray((submission.normalizedPayload as { passengers?: unknown[] } | null)?.passengers)
            ? ((submission.normalizedPayload as { passengers?: unknown[] }).passengers?.length ?? 0)
            : 0,
          segmentCount: Array.isArray((submission.normalizedPayload as { segments?: unknown[] } | null)?.segments)
            ? ((submission.normalizedPayload as { segments?: unknown[] }).segments?.length ?? 0)
            : 0,
        }))}
        transportTasks={transportTasks.map((task) => ({
          id: task.id,
          taskType: task.taskType,
          status: task.status,
          airport: task.airport.code,
          mandir: task.mandir?.name ?? "Unassigned",
          scheduledTimeLocal: task.scheduledTimeLocal?.toISOString() ?? null,
          driverIds: task.drivers.map((driver) => driver.driverId),
          driverNames: task.drivers.map((driver) => driver.driver.name),
        }))}
        drivers={drivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          airportCodes: driver.driverAirports.map((assignment) => assignment.airport.code),
        }))}
      />
    </AppShell>
  );
}
