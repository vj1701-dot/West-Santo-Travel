import { addFlightSegment, createApprovalRequest } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const segmentSchema = z.object({
  segmentOrder: z.number().int().min(1),
  airline: z.string().min(1),
  flightNumber: z.string().min(1),
  departureAirportId: z.string().uuid(),
  arrivalAirportId: z.string().uuid(),
  departureTimeLocal: z.string().min(1),
  arrivalTimeLocal: z.string().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const json = await request.json();
  const parsed = segmentSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid segment payload.", 400);
  }

  if (auth.role === "COORDINATOR") {
    const approval = await createApprovalRequest({
      itineraryId: id,
      requestedByUserId: auth.id,
      entityType: "FLIGHT_SEGMENT_CREATE",
      proposedPayload: {
        itineraryId: id,
        ...parsed.data,
      },
    });

    return ok({ approvalQueued: true, approvalId: approval.id }, { status: 202 });
  }

  return ok(await addFlightSegment({ itineraryId: id, ...parsed.data }), { status: 201 });
}
