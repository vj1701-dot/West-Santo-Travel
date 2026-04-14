import { PassengerType } from "@prisma/client";
import { updatePassenger } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/guards";

const updatePassengerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  legalName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  passengerType: z.nativeEnum(PassengerType).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const json = await request.json();
  const parsed = updatePassengerSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid passenger update payload.", 400);
  }

  return ok(await updatePassenger(id, parsed.data));
}
