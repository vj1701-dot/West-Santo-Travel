import { listItineraries, listPassengerItineraries } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { ItineraryList } from "@/components/itinerary-list";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ItinerariesPage({
  searchParams,
}: {
  searchParams?: Promise<{ itineraryId?: string | string[] }>;
}) {
  const currentUser = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const focusedItineraryId = Array.isArray(resolvedSearchParams.itineraryId)
    ? resolvedSearchParams.itineraryId[0]
    : resolvedSearchParams.itineraryId;
  const itineraries =
    currentUser.role === "PASSENGER" ? await listPassengerItineraries(currentUser.id) : await listItineraries();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Itineraries"
        tooltip="Review complete trip records, flight legs, passengers, booking data, transport, and accommodation"
      />
      <ItineraryList
        itineraries={itineraries.map(({ booking: _booking, flightSegments, transportTasks, ...rest }) => ({
          ...rest,
          flightSegments: flightSegments.map(({ departureAirport, arrivalAirport, ...seg }) => ({
            ...seg,
            departureAirport: { code: departureAirport.code, name: departureAirport.name, city: departureAirport.city },
            arrivalAirport: { code: arrivalAirport.code, name: arrivalAirport.name, city: arrivalAirport.city },
          })),
          transportTasks: transportTasks.map(({ airport, ...task }) => ({
            ...task,
            airport: { code: airport.code },
          })),
        }))}
        focusedItineraryId={focusedItineraryId}
        role={currentUser.role}
      />
    </AppShell>
  );
}
