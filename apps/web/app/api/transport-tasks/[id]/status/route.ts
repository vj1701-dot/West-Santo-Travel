import { TransportTaskStatus } from "@prisma/client";
import { updateTransportTaskStatus } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const statusSchema = z.object({
  status: z.nativeEnum(TransportTaskStatus),
  note: z.string().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const json = await request.json();
  const parsed = statusSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid transport status payload.", 400);
  }

  try {
    const task = await updateTransportTaskStatus({
      taskId: id,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
      changedByUserId: auth.id,
    });

    return ok(task);
  } catch (error) {
    return fail("NOT_FOUND", error instanceof Error ? error.message : "Transport task not found.", 404);
  }
}
