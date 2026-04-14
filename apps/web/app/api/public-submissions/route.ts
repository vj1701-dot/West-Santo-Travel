import { SubmissionStatus } from "@prisma/client";
import { createPublicSubmission, listPublicSubmissions } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/guards";

const passengerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().nullable().optional(),
  passengerType: z.enum(["WEST_SANTO", "GUEST_SANTO", "HARIBHAKTO", "EXTRA_SEAT"]),
});

const segmentSchema = z.object({
  airline: z.string().min(1),
  flightNumber: z.string().min(1),
  departureAirport: z.string().min(3),
  arrivalAirport: z.string().min(3),
  departureTimeLocal: z.string().min(1),
  arrivalTimeLocal: z.string().min(1),
});

const createSubmissionSchema = z.object({
  submitterName: z.string().min(1),
  submitterPhone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  passengers: z.array(passengerSchema).min(1),
  segments: z.array(segmentSchema).min(1),
});

function normalizeSubmission(input: z.infer<typeof createSubmissionSchema>) {
  return {
    submitterName: input.submitterName.trim(),
    submitterPhone: input.submitterPhone?.trim() || null,
    notes: input.notes?.trim() || null,
    passengers: input.passengers.map((passenger) => ({
      firstName: passenger.firstName.trim(),
      lastName: passenger.lastName.trim(),
      phone: passenger.phone?.trim() || null,
      passengerType: passenger.passengerType,
    })),
    segments: input.segments.map((segment, index) => ({
      segmentOrder: index + 1,
      airline: segment.airline.trim(),
      flightNumber: segment.flightNumber.trim().toUpperCase(),
      departureAirport: segment.departureAirport.trim().toUpperCase(),
      arrivalAirport: segment.arrivalAirport.trim().toUpperCase(),
      departureTimeLocal: segment.departureTimeLocal,
      arrivalTimeLocal: segment.arrivalTimeLocal,
    })),
  };
}

export async function GET(request: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const requestedStatus = searchParams.get("status");
  const status =
    requestedStatus && requestedStatus in SubmissionStatus
      ? SubmissionStatus[requestedStatus as keyof typeof SubmissionStatus]
      : undefined;

  return ok(await listPublicSubmissions(status));
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = createSubmissionSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid submission payload.", 400);
  }

  const normalizedPayload = normalizeSubmission(parsed.data);
  const submission = await createPublicSubmission({
    rawPayload: parsed.data,
    normalizedPayload,
    notes: parsed.data.notes ?? null,
  });

  return ok(
    {
      id: submission.id,
      status: submission.status,
      message: "Submission received and queued for admin review.",
    },
    { status: 201 },
  );
}
