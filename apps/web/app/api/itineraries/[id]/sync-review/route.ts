import { applyGoogleSheetsTravelerChanges } from "@west-santo/data";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  try {
    return ok(await applyGoogleSheetsTravelerChanges(id, auth.id));
  } catch (error) {
    return fail("BAD_REQUEST", error instanceof Error ? error.message : "Unable to apply Google Sheets traveler changes.", 400);
  }
}
