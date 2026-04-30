import { createDriver, listDrivers } from "@west-santo/data";
import { z } from "zod";

import { ok } from "@/lib/api/response";
import { fail } from "@/lib/api/response";
import { requireApiRoles, requireApiUser } from "@/lib/auth/guards";

const createDriverSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  airportIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;

  return ok(await listDrivers());
}

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const json = await request.json();
  const parsed = createDriverSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid driver payload.", 400);
  }

  return ok(await createDriver(parsed.data), { status: 201 });
}
