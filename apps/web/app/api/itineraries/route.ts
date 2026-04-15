import { createItinerary, createTrip, listItineraries } from "@west-santo/data";
import { TransportTaskType } from "@prisma/client";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const createItinerarySchema = z.object({
  notes: z.string().nullable().optional(),
  passengerIds: z.array(z.string().uuid()).min(1),
  createdByUserId: z.string().uuid().nullable().optional(),
});

const createTripSchema = z.object({
  notes: z.string().nullable().optional(),
  passengerIds: z.array(z.string().uuid()).min(1),
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
  const tripParsed = createTripSchema.safeParse(json);

  if (tripParsed.success) {
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
