import type { Env } from "../env";
import { json } from "../http";
import { dashboard } from "../db/analyses";

export async function getDashboard(env: Env): Promise<Response> {
  return json(await dashboard(env.DB));
}
