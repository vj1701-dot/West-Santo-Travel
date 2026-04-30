import { ReminderAudience, ReminderChannel, ReminderTrigger } from "@prisma/client";
import { deleteReminderRule, getReminderRule, updateReminderRule } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";
const INVALID_SCOPE_AIRPORT_ID = "00000000-0000-0000-0000-000000000000";

const updateReminderRuleSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  trigger: z.nativeEnum(ReminderTrigger).optional(),
  audience: z.nativeEnum(ReminderAudience).optional(),
  channel: z.nativeEnum(ReminderChannel).optional(),
  offsetMinutes: z.number().int().optional(),
  template: z.string().min(1).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const existingRule = await getReminderRule(id);
  if (!existingRule) {
    return fail("NOT_FOUND", "Reminder rule not found.", 404);
  }
  if (auth.role === "COORDINATOR" && existingRule.createdByUserId !== auth.id) {
    return fail("FORBIDDEN", "You do not have access to this reminder rule.", 403);
  }
  const json = await request.json();
  const parsed = updateReminderRuleSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid reminder rule update payload.", 400);
  }
  return ok(
    await updateReminderRule(id, {
      ...parsed.data,
      airportScopeIds:
        auth.role === "COORDINATOR"
          ? auth.coordinatorAirports.length > 0
            ? auth.coordinatorAirports.map((assignment) => assignment.airportId)
            : [INVALID_SCOPE_AIRPORT_ID]
          : undefined,
    }),
  );
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const existingRule = await getReminderRule(id);
  if (!existingRule) {
    return fail("NOT_FOUND", "Reminder rule not found.", 404);
  }
  if (auth.role === "COORDINATOR" && existingRule.createdByUserId !== auth.id) {
    return fail("FORBIDDEN", "You do not have access to this reminder rule.", 403);
  }

  return ok(await deleteReminderRule(id));
}
