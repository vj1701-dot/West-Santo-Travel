import { getDashboardSnapshot } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(request.url);
  const passengerId = searchParams.get("passengerId") || undefined;
  const requestedAirportId = searchParams.get("airportId") || undefined;
  const airportIds =
    auth.role === "COORDINATOR"
      ? requestedAirportId
        ? auth.coordinatorAirports
            .map((assignment) => assignment.airportId)
            .filter((airportId) => airportId === requestedAirportId)
        : auth.coordinatorAirports.map((assignment) => assignment.airportId)
      : requestedAirportId
        ? [requestedAirportId]
        : undefined;
  const dashboard = await getDashboardSnapshot({
    role: auth.role,
    airportIds,
    passengerId,
  });
  return ok(dashboard);
}
