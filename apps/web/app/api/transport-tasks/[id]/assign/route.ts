import { assignDriversToTransportTask } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const assignSchema = z.object({
  driverIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const json = await request.json();
  const parsed = assignSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid driver assignment payload.", 400);
  }

  const task = await assignDriversToTransportTask({
    taskId: id,
    driverIds: parsed.data.driverIds,
    assignedByUserId: auth.id,
  });

  return ok(task);
}
