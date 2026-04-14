import { listDrivers } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;

  return ok(await listDrivers());
}
