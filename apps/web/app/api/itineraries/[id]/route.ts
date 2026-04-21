import { createApprovalRequest, deleteItinerary, getItineraryDetail, updateItinerary, updateTrip } from "@west-santo/data";
import { ItineraryStatus, TransportTaskType } from "@prisma/client";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRole, requireApiRoles } from "@/lib/auth/guards";

const travelerRefSchema = z.object({
  entityType: z.enum(["PASSENGER", "USER", "DRIVER"]),
  entityId: z.string().uuid(),
});

const updateItinerarySchema = z.object({
  notes: z.string().nullable().optional(),
  status: z.nativeEnum(ItineraryStatus).optional(),
  isArchived: z.boolean().optional(),
  passengerIds: z.array(z.string().uuid()).optional(),
  travelerRefs: z.array(travelerRefSchema).optional(),
  booking: z
    .object({
      confirmationNumber: z.string().nullable().optional(),
      totalCost: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  accommodation: z
    .object({
      notes: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  segments: z
    .array(
      z.object({
        segmentOrder: z.number().int().min(1),
        airline: z.string().min(1),
        flightNumber: z.string().min(1),
        departureAirportId: z.string().uuid(),
        arrivalAirportId: z.string().uuid(),
        departureTimeLocal: z.string().min(1),
        arrivalTimeLocal: z.string().min(1),
        transportEntries: z
          .array(
            z.object({
              taskType: z.nativeEnum(TransportTaskType),
              driverIds: z.array(z.string().uuid()).optional(),
              notes: z.string().nullable().optional(),
              scheduledTimeLocal: z.string().nullable().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
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

  const isFullTripUpdate =
    Array.isArray(parsed.data.passengerIds) || Array.isArray(parsed.data.travelerRefs) || Array.isArray(parsed.data.segments);

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
        isArchived: itinerary.isArchived,
      },
      proposedPayload: parsed.data,
    });

    return ok({ approvalQueued: true, approvalId: approval.id }, { status: 202 });
  }

  if (isFullTripUpdate) {
    const passengerIds = parsed.data.passengerIds ?? [];
    const travelerRefs = parsed.data.travelerRefs ?? [];
    const segments = parsed.data.segments ?? [];
    if (passengerIds.length === 0 && travelerRefs.length === 0) {
      return fail("BAD_REQUEST", "Select at least one traveler.", 400);
    }
    return ok(
      await updateTrip(id, {
        createdByUserId: auth.id,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        passengerIds,
        travelerRefs,
        booking: parsed.data.booking ?? null,
        accommodation: parsed.data.accommodation ?? null,
        segments,
      }),
    );
  }

  return ok(
    await updateItinerary(id, {
      ...parsed.data,
      actorUserId: auth.id,
    }),
  );
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  return ok(await deleteItinerary(id, auth.id));
}
