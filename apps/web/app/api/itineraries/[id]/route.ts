import { createApprovalRequest, getItineraryDetail, updateItinerary } from "@west-santo/data";
import { ItineraryStatus } from "@prisma/client";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const updateItinerarySchema = z.object({
  notes: z.string().nullable().optional(),
  status: z.nativeEnum(ItineraryStatus).optional(),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR", "PASSENGER"]);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const itinerary = await getItineraryDetail(id);

  if (!itinerary) {
    return fail("NOT_FOUND", "Itinerary not found.", 404);
  }

  return ok(itinerary);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const json = await request.json();
  const parsed = updateItinerarySchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid itinerary update payload.", 400);
  }

  if (auth.role === "COORDINATOR") {
    const itinerary = await getItineraryDetail(id);

    if (!itinerary) {
      return fail("NOT_FOUND", "Itinerary not found.", 404);
    }

    const approval = await createApprovalRequest({
      itineraryId: id,
      requestedByUserId: auth.id,
      entityType: "ITINERARY_UPDATE",
      originalPayload: {
        notes: itinerary.notes,
        status: itinerary.status,
      },
      proposedPayload: parsed.data,
    });

    return ok({ approvalQueued: true, approvalId: approval.id }, { status: 202 });
  }

  return ok(await updateItinerary(id, parsed.data));
}
