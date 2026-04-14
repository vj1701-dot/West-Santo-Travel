import { ApprovalStatus } from "@prisma/client";
import { reviewApprovalRequest } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/guards";

const reviewSchema = z.object({
  status: z.nativeEnum(ApprovalStatus),
  reviewComment: z.string().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const json = await request.json();
  const parsed = reviewSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid approval review payload.", 400);
  }

  try {
    const approval = await reviewApprovalRequest({
      id,
      ...parsed.data,
      reviewedByUserId: auth.id,
    });

    return ok(approval);
  } catch (error) {
    return fail("BAD_REQUEST", error instanceof Error ? error.message : "Unable to review approval request.", 400);
  }
}
