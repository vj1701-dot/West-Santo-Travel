import { syncGoogleSheetsSnapshot } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";

const tripSchema = z.object({
  externalKey: z.string().min(1),
  locatorNumber: z.string().nullable().optional(),
  airline: z.string().min(1),
  flightNumber: z.string().min(1),
  departureAirport: z.string().min(3),
  departureDate: z.string().min(1),
  departureTime: z.string().min(1),
  arrivalAirport: z.string().min(3),
  arrivalDate: z.string().min(1),
  arrivalTime: z.string().min(1),
  cost: z.string().nullable().optional(),
  passengers: z.array(
    z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
    }),
  ).min(1),
  pickupDriverName: z.string().nullable().optional(),
  dropoffDriverName: z.string().nullable().optional(),
  sourceRows: z.array(z.number().int().positive()).optional(),
});

const snapshotSchema = z.object({
  source: z.literal("google-sheets"),
  syncedAt: z.string().min(1),
  sheetName: z.string().min(1),
  trips: z.array(tripSchema),
});

export async function POST(request: Request) {
  const expectedSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET?.trim();
  if (!expectedSecret) {
    return fail("SERVICE_UNAVAILABLE", "Google Sheets sync is not configured.", 503);
  }

  const providedSecret = request.headers.get("x-sync-secret")?.trim();
  if (!providedSecret || providedSecret !== expectedSecret) {
    return fail("FORBIDDEN", "Invalid sync secret.", 403);
  }

  const json = await request.json();
  const parsed = snapshotSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid Google Sheets snapshot.", 400);
  }

  try {
    return ok(await syncGoogleSheetsSnapshot(parsed.data));
  } catch (error) {
    return fail("BAD_REQUEST", error instanceof Error ? error.message : "Unable to process Google Sheets snapshot.", 400);
  }
}
