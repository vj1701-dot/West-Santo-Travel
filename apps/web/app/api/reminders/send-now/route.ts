import { queueOneOffFlightReminder } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";
const INVALID_SCOPE_AIRPORT_ID = "00000000-0000-0000-0000-000000000000";

const schema = z.object({
  flightSegmentId: z.string().uuid(),
  channel: z.enum(["TELEGRAM", "SMS", "TELEGRAM_SMS"]),
  message: z.string().max(1000).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
  }

  const scopedResult = await queueOneOffFlightReminder({
    ...parsed.data,
    airportIds:
      auth.role === "COORDINATOR"
        ? auth.coordinatorAirports.length > 0
          ? auth.coordinatorAirports.map((assignment) => assignment.airportId)
          : [INVALID_SCOPE_AIRPORT_ID]
        : undefined,
  });
  return ok(scopedResult);
}
