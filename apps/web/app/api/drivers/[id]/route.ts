import { updateDriver } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const updateDriverSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  airportIds: z.array(z.string().uuid()).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const json = await request.json();
  const parsed = updateDriverSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid driver update payload.", 400);
  }

  return ok(await updateDriver(id, parsed.data));
}
