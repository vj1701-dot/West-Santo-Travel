import { UserRole } from "@prisma/client";
import { createUser, listUsers } from "@west-santo/data";
import { z } from "zod";

import { requireApiRoles } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api/response";

const createUserSchema = z.object({
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(UserRole),
  airportIds: z.array(z.string().uuid()).optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  return ok(await listUsers(search));
}

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const json = await request.json();
  const parsed = createUserSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid user payload.", 400);
  }

  return ok(await createUser(parsed.data), { status: 201 });
}
