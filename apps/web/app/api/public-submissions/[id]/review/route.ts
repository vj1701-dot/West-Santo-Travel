import { reviewPublicSubmission } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "DUPLICATE_FLAGGED"]),
  reviewNote: z.string().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const json = await request.json();
  const parsed = reviewSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid public submission review payload.", 400);
  }

  try {
    const submission = await reviewPublicSubmission({
      id,
      status: parsed.data.status,
      reviewedByUserId: auth.id,
      reviewNote: parsed.data.reviewNote ?? null,
    });

    return ok(submission);
  } catch (error) {
    return fail("BAD_REQUEST", error instanceof Error ? error.message : "Unable to review public submission.", 400);
  }
}
