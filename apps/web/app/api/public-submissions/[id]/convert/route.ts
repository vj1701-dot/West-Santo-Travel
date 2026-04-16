import { TransportTaskType } from "@prisma/client";
import { createTripFromPublicSubmission } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const convertSubmissionSchema = z.object({
  notes: z.string().nullable().optional(),
  passengers: z
    .array(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().nullable().optional(),
        passengerType: z.enum(["WEST_SANTO", "GUEST_SANTO", "HARIBHAKTO", "EXTRA_SEAT"]).optional(),
      }),
    )
    .min(1),
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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const json = await request.json();
  const parsed = convertSubmissionSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid submission conversion payload.", 400);
  }

  return ok(
    await createTripFromPublicSubmission(id, {
      ...parsed.data,
      createdByUserId: auth.id,
      reviewedByUserId: auth.id,
    }),
    { status: 201 },
  );
}
