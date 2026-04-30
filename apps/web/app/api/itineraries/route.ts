import { createItinerary, createTrip, listItineraries } from "@west-santo/data";
import { TransportTaskType } from "@prisma/client";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";
const INVALID_SCOPE_AIRPORT_ID = "00000000-0000-0000-0000-000000000000";

const createItinerarySchema = z.object({
  notes: z.string().nullable().optional(),
  passengerIds: z.array(z.string().uuid()).default([]),
  createdByUserId: z.string().uuid().nullable().optional(),
}).refine((value) => value.passengerIds.length > 0, {
  message: "Select at least one traveler.",
  path: ["passengerIds"],
});

const createTripSchema = z.object({
  notes: z.string().nullable().optional(),
  passengerIds: z.array(z.string().uuid()).default([]),
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
    .min(1),
}).refine((value) => value.passengerIds.length > 0, {
  message: "Select at least one traveler.",
  path: ["passengerIds"],
});

export async function GET() {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const itineraries = await listItineraries({
    airportIds:
      auth.role === "COORDINATOR"
        ? auth.coordinatorAirports.length > 0
          ? auth.coordinatorAirports.map((assignment) => assignment.airportId)
          : [INVALID_SCOPE_AIRPORT_ID]
        : undefined,
  });
  return ok(itineraries);
}

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const json = await request.json();
  const tripParsed = createTripSchema.safeParse(json);

  if (tripParsed.success) {
    if (auth.role === "COORDINATOR" && tripParsed.data.booking !== undefined) {
      return fail("FORBIDDEN", "Booking details are admin-only.", 403);
    }
    const itinerary = await createTrip({
      ...tripParsed.data,
      createdByUserId: auth.id,
    });
    return ok(itinerary, { status: 201 });
  }

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

