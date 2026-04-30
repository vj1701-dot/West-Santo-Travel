import { ReminderAudience, ReminderChannel, ReminderTrigger } from "@prisma/client";
import { createReminderRule, listReminderRules } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";
const INVALID_SCOPE_AIRPORT_ID = "00000000-0000-0000-0000-000000000000";

const createReminderRuleSchema = z.object({
  name: z.string().min(1),
  trigger: z.nativeEnum(ReminderTrigger),
  audience: z.nativeEnum(ReminderAudience),
  channel: z.nativeEnum(ReminderChannel),
  offsetMinutes: z.number().int(),
  template: z.string().min(1),
});

export async function GET() {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  return ok(await listReminderRules(auth.role === "COORDINATOR" ? { createdByUserId: auth.id } : undefined));
}

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const json = await request.json();
  const parsed = createReminderRuleSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid reminder rule payload.", 400);
  }

  return ok(
    await createReminderRule({
      ...parsed.data,
      createdByUserId: auth.id,
      airportScopeIds:
        auth.role === "COORDINATOR"
          ? auth.coordinatorAirports.length > 0
            ? auth.coordinatorAirports.map((assignment) => assignment.airportId)
            : [INVALID_SCOPE_AIRPORT_ID]
          : [],
    }),
    { status: 201 },
  );
}
