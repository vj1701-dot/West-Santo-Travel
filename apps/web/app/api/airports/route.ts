import { listAirportOptions, listAirports } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const mode = searchParams.get("mode");

  if (mode === "options") {
    return ok(await listAirportOptions(search));
  }

  return ok(await listAirports());
}
