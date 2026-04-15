import { PassengerType } from "@prisma/client";
import { createPassenger, listPassengerOptions, listPassengers } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRole, requireApiRoles } from "@/lib/auth/guards";

const createPassengerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  legalName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  passengerType: z.nativeEnum(PassengerType),
  notes: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const mode = searchParams.get("mode");

  if (mode === "options") {
    return ok(await listPassengerOptions(search));
  }

  const passengers = await listPassengers(search);
  return ok(passengers);
}

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const json = await request.json();
  const parsed = createPassengerSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid passenger payload.", 400);
  }

  const passenger = await createPassenger(parsed.data);
  return ok(passenger, { status: 201 });
}
