import { listUpcomingFlightSegments } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";
const INVALID_SCOPE_AIRPORT_ID = "00000000-0000-0000-0000-000000000000";

export async function GET() {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const segments = await listUpcomingFlightSegments(30, {
    airportIds:
      auth.role === "COORDINATOR"
        ? auth.coordinatorAirports.length > 0
          ? auth.coordinatorAirports.map((assignment) => assignment.airportId)
          : [INVALID_SCOPE_AIRPORT_ID]
        : undefined,
  });
  return ok(
    segments.map((s) => ({
      id: s.id,
      flightNumber: s.flightNumber,
      departureAirport: s.departureAirport.code,
      arrivalAirport: s.arrivalAirport.code,
      departureTimeLocal: s.departureTimeLocal.toISOString(),
      departureTimeZone: s.departureTimeZone,
      passengerCount: s.itinerary.itineraryPassengers.length,
    })),
  );
}
