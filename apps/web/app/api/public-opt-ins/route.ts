import { OptInRole } from "@prisma/client";
import { createPublicOptIn, listPublicOptIns } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";
import { PUBLIC_OPT_IN_CONSENT_TEXT, PUBLIC_OPT_IN_SOURCE_PATH } from "@/lib/public-opt-in";

const createPublicOptInSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  role: z.nativeEnum(OptInRole),
  hasMessagingConsent: z.literal(true),
});

export async function GET() {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;

  return ok(await listPublicOptIns());
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = createPublicOptInSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid opt-in payload.", 400);
  }

  try {
    const optIn = await createPublicOptIn({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      role: parsed.data.role,
      consentText: PUBLIC_OPT_IN_CONSENT_TEXT,
      sourcePath: PUBLIC_OPT_IN_SOURCE_PATH,
    });

    return ok(
      {
        id: optIn.id,
        role: optIn.role,
        message: "Opt-in received.",
      },
      { status: 201 },
    );
  } catch (error) {
    return fail("BAD_REQUEST", error instanceof Error ? error.message : "Unable to create opt-in.", 400);
  }
}
