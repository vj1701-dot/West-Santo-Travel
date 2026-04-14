import { listTransportTasks } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiRoles } from "@/lib/auth/guards";

export async function GET() {
  const auth = await requireApiRoles(["ADMIN", "COORDINATOR"]);
  if (auth instanceof Response) return auth;
  const tasks = await listTransportTasks();
  return ok(tasks);
}
