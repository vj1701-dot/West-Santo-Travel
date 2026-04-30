import { listItineraries } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { ItineraryList } from "@/components/itinerary-list";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
const INVALID_SCOPE_AIRPORT_ID = "00000000-0000-0000-0000-000000000000";

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
  const coordinatorAirportIds =
    currentUser.role === "COORDINATOR"
      ? currentUser.coordinatorAirports.map((assignment) => assignment.airportId)
      : undefined;
  const scopedAirportIds =
    currentUser.role === "COORDINATOR" ? (coordinatorAirportIds!.length > 0 ? coordinatorAirportIds : [INVALID_SCOPE_AIRPORT_ID]) : undefined;
  const [itineraries, allItineraries] = await Promise.all([
    listItineraries({ airportIds: scopedAirportIds }),
    listItineraries({ includeArchived: true, airportIds: scopedAirportIds }),
  ]);

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Itineraries"
        tooltip="Review complete trip records, flight legs, passengers, booking data, transport, and accommodation"
      />
      <ItineraryList
        activeSource={itineraries.map(({ booking: _booking, flightSegments, transportTasks, ...rest }) => ({
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
        archivedSource={allItineraries.map(({ booking: _booking, flightSegments, transportTasks, ...rest }) => ({
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
      />
    </AppShell>
  );
}
