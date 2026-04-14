import { UserRole } from "@prisma/client";
import { updateUser } from "@west-santo/data";
import { z } from "zod";

import { requireApiRole } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api/response";

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const json = await request.json();
  const parsed = updateUserSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid user update payload.", 400);
  }

  return ok(await updateUser(id, parsed.data));
}
