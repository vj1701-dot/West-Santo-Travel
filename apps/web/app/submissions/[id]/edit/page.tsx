import { getPublicSubmission, listAirports, listDrivers } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SubmissionTripBuilder } from "@/components/submission-trip-builder";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type SubmissionPayload = {
  submitterName?: string | null;
  submitterPhone?: string | null;
  notes?: string | null;
  passengers?: Array<{
    firstName: string;
    lastName: string;
    phone?: string | null;
    passengerType?: "WEST_SANTO" | "GUEST_SANTO" | "HARIBHAKTO" | "EXTRA_SEAT";
  }>;
  segments?: Array<{
    airline: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureTimeLocal: string;
    arrivalTimeLocal: string;
  }>;
};

export default async function EditSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }

  const { id } = await params;
  const [submission, airports, drivers] = await Promise.all([getPublicSubmission(id), listAirports(), listDrivers()]);

  if (!submission) {
    redirect("/submissions");
  }

  const payload = ((submission.normalizedPayload ?? submission.rawPayload) ?? {}) as SubmissionPayload;

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Complete Submission"
        tooltip="Fill in booking, transport, and accommodation details before moving this submission into itineraries"
      />
      <SubmissionTripBuilder
        mode="review"
        submitLabel="Create itinerary"
        submitUrl={`/api/public-submissions/${submission.id}/convert`}
        successPath="/itineraries"
        initialValue={{
          submitterName: payload.submitterName ?? "",
          submitterPhone: payload.submitterPhone ?? "",
          notes: payload.notes ?? submission.notes ?? "",
          passengers: payload.passengers ?? [],
          segments: (payload.segments ?? []).map((segment) => ({
            airline: segment.airline,
            flightNumber: segment.flightNumber,
            departureAirportCode: segment.departureAirport,
            arrivalAirportCode: segment.arrivalAirport,
            departureTimeLocal: segment.departureTimeLocal,
            arrivalTimeLocal: segment.arrivalTimeLocal,
          })),
        }}
        airports={airports.map((airport) => ({
          id: airport.id,
          code: airport.code,
          name: airport.name,
          city: airport.city,
          country: airport.country,
        }))}
        drivers={drivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          airportCodes: driver.driverAirports.map((entry) => entry.airport.code),
        }))}
      />
    </AppShell>
  );
}
