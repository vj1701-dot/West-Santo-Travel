import { linkTelegramEntity } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

const telegramLinkSchema = z.object({
  entityType: z.enum(["USER", "PASSENGER", "DRIVER"]),
  entityId: z.string().uuid(),
  chatId: z.string().min(1),
  telegramUsername: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const json = await request.json();
  const parsed = telegramLinkSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid Telegram link payload.", 400);
  }

  return ok(
    await linkTelegramEntity({
      ...parsed.data,
      actorUserId: auth.id,
    }),
  );
}
