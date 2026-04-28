import { getDashboardSnapshot } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

const INVALID_SCOPE_FILTER = "__none__";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(request.url);
  const passengerIds = searchParams.getAll("passengerId").filter(Boolean);
  const requestedAirportIds = searchParams.getAll("airportId").filter(Boolean);
  const coordinatorAirportIds = auth.coordinatorAirports.map((assignment) => assignment.airportId);
  const airportIds =
    auth.role === "COORDINATOR"
      ? requestedAirportIds.length > 0
        ? (() => {
            const allowedAirportIds = coordinatorAirportIds.filter((airportId) => requestedAirportIds.includes(airportId));
            return allowedAirportIds.length > 0 ? allowedAirportIds : [INVALID_SCOPE_FILTER];
          })()
        : coordinatorAirportIds
      : requestedAirportIds.length > 0
        ? requestedAirportIds
        : undefined;
  const dashboard = await getDashboardSnapshot({
    role: auth.role,
    airportIds,
    passengerIds: passengerIds.length > 0 ? passengerIds : undefined,
  });
  return ok(dashboard);
}
