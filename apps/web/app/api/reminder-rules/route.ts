import { ReminderAudience, ReminderChannel, ReminderTrigger } from "@prisma/client";
import { createReminderRule, listReminderRules } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

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
  return ok(await listReminderRules());
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
    }),
    { status: 201 },
  );
}
