import { linkTelegramAccount } from "@west-santo/data";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";

const linkTelegramSchema = z.object({
  chatId: z.string().min(1),
  telegramUsername: z.string().nullable().optional(),
  input: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = linkTelegramSchema.safeParse(json);

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid link payload.", 400);
  }

  const result = await linkTelegramAccount(parsed.data.chatId, parsed.data.input, parsed.data.telegramUsername);

  if (!result.linked) {
    return fail("NO_MATCH", "No matching account found.", 404);
  }

  return ok(result);
}
