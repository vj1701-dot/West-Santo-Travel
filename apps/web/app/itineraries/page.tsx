import { listItineraries, listPassengerItineraries } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { ItineraryList } from "@/components/itinerary-list";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ItinerariesPage() {
  const currentUser = await requireUser();
  const itineraries =
    currentUser.role === "PASSENGER" ? await listPassengerItineraries(currentUser.id) : await listItineraries();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Itineraries"
        tooltip="Review complete trip records, flight legs, passengers, booking data, transport, and accommodation"
      />
      <ItineraryList itineraries={itineraries} role={currentUser.role} />
    </AppShell>
  );
}
