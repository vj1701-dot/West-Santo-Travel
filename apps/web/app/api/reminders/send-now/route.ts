import { queueOneOffFlightReminder } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

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

  const result = await queueOneOffFlightReminder(parsed.data);
  return ok(result);
}
