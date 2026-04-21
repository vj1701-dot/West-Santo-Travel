import { getItineraryDetail, listAirports, listDrivers, listPassengers, listUsers } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { GoogleSheetsSyncReviewPanel } from "@/components/google-sheets-sync-review-panel";
import { ItineraryLifecycleActions } from "@/components/itinerary-lifecycle-actions";
import { PageHeader } from "@/components/page-header";
import { TripBuilder } from "@/components/trip-builder";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function toLocalInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default async function EditItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }

  const { id } = await params;
  const [itinerary, passengers, airports, drivers, users] = await Promise.all([
    getItineraryDetail(id),
    listPassengers(),
    listAirports(),
    listDrivers(),
    listUsers(),
  ]);

  if (!itinerary) {
    redirect("/itineraries");
  }

  const googleSheetsSyncLink = itinerary.externalSyncLinks.find((link) => link.provider === "google-sheets");
  const pendingRosterDiff =
    googleSheetsSyncLink?.syncStatus === "REVIEW_REQUIRED" && googleSheetsSyncLink.pendingRosterDiff && typeof googleSheetsSyncLink.pendingRosterDiff === "object"
      ? googleSheetsSyncLink.pendingRosterDiff
      : null;

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Edit Itinerary"
        tooltip="Update passengers, flights, transport, and notes for this trip"
        actions={
          <ItineraryLifecycleActions
            itineraryId={itinerary.id}
            isArchived={itinerary.isArchived}
            role={currentUser.role as "ADMIN" | "COORDINATOR"}
          />
        }
      />
      {pendingRosterDiff ? <GoogleSheetsSyncReviewPanel itineraryId={itinerary.id} pendingRosterDiff={pendingRosterDiff as Record<string, unknown>} /> : null}
      <TripBuilder
        drivers={drivers.map((driver) => ({
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
        initialTrip={{
          id: itinerary.id,
          notes: itinerary.notes,
          passengerIds: itinerary.itineraryPassengers.map((item) => item.passenger.id),
          booking: {
            confirmationNumber: itinerary.booking?.confirmationNumber ?? null,
            totalCost: itinerary.booking?.totalCost ? Number(itinerary.booking.totalCost) : null,
          },
          accommodation: {
            notes: itinerary.accommodations[0]?.notes ?? null,
          },
          segments: itinerary.flightSegments.map((segment) => ({
            airline: segment.airline,
            flightNumber: segment.flightNumber,
            departureAirportId: segment.departureAirportId,
            arrivalAirportId: segment.arrivalAirportId,
            departureTimeLocal: toLocalInputValue(segment.departureTimeLocal),
            arrivalTimeLocal: toLocalInputValue(segment.arrivalTimeLocal),
            transportEntries: itinerary.transportTasks
              .filter((task) => task.flightSegmentId === segment.id)
              .map((task) => ({
                taskType: task.taskType,
                driverIds: task.drivers.map((entry) => entry.driver.id),
                notes: task.notes ?? null,
              })),
          })),
        }}
        method="PATCH"
        submitLabel="Save changes"
        submitUrl={`/api/itineraries/${itinerary.id}`}
        successPath="/itineraries"
      />
    </AppShell>
  );
}
