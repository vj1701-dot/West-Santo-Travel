import { listUpcomingFlightSegments } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

export async function GET() {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const segments = await listUpcomingFlightSegments();
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
