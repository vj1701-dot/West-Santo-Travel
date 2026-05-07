import { addFlightSegment, createApprovalRequest, getItineraryDetail } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

function itineraryTouchesAirportScope(
  itinerary: NonNullable<Awaited<ReturnType<typeof getItineraryDetail>>>,
  airportIds: string[],
) {
  if (airportIds.length === 0) {
    return false;
  }

  return (
    itinerary.flightSegments.some(
      (segment) => airportIds.includes(segment.departureAirportId) || airportIds.includes(segment.arrivalAirportId),
    ) || itinerary.transportTasks.some((task) => airportIds.includes(task.airportId))
  );
}

function validateCoordinatorSegmentScope(
  segment: {
    departureAirportId: string;
    arrivalAirportId: string;
  },
  airportIds: string[],
) {
  if (!airportIds.includes(segment.departureAirportId)) {
    return "Coordinators can add drop off airports only when the departure airport is assigned to them.";
  }

  if (!airportIds.includes(segment.arrivalAirportId)) {
    return "Coordinators can add pickup airports only when the arrival airport is assigned to them.";
  }

  return null;
}

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
    const scopedAirportIds = auth.coordinatorAirports.map((assignment) => assignment.airportId);
    const itinerary = await getItineraryDetail(id);
    if (!itinerary) {
      return fail("NOT_FOUND", "Itinerary not found.", 404);
    }
    if (!itineraryTouchesAirportScope(itinerary, scopedAirportIds)) {
      return fail("FORBIDDEN", "You do not have access to this itinerary.", 403);
    }
    const scopeError = validateCoordinatorSegmentScope(parsed.data, scopedAirportIds);
    if (scopeError) {
      return fail("FORBIDDEN", scopeError, 403);
    }

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
