import { createItinerary, listItineraries } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const createItinerarySchema = z.object({
  notes: z.string().nullable().optional(),
  passengerIds: z.array(z.string().uuid()).min(1),
  createdByUserId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const itineraries = await listItineraries();
  return ok(itineraries);
}

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const json = await request.json();
  const parsed = createItinerarySchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid itinerary payload.", 400);
  }

  const itinerary = await createItinerary({
    ...parsed.data,
    createdByUserId: auth.id,
  });
  return ok(itinerary, { status: 201 });
}
