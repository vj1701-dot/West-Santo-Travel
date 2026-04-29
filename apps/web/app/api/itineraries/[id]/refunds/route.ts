import { createRefundEvent } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/guards";

const createRefundSchema = z.object({
  amount: z.number().positive(),
  refundedAt: z.string().min(1),
  note: z.string().nullable().optional(),
  passengerId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const json = await request.json();
  const parsed = createRefundSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid refund payload.", 400);
  }

  try {
    return ok(
      await createRefundEvent({
        itineraryId: id,
        amount: parsed.data.amount,
        refundedAt: parsed.data.refundedAt,
        note: parsed.data.note ?? null,
        passengerId: parsed.data.passengerId ?? null,
        recordedByUserId: auth.id,
      }),
      { status: 201 },
    );
  } catch (error) {
    return fail("BAD_REQUEST", error instanceof Error ? error.message : "Unable to save refund.", 400);
  }
}
