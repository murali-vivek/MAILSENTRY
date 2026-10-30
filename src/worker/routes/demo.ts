import { confirmFlag, json, readJson } from "../http";
import type { Env } from "../env";
import { assertDemoEnabled, demoEnabled, resetDemo, seedDemo } from "../services/demo";

export function status(env: Env): Response {
  return json({ enabled: demoEnabled(env) });
}

export async function seed(env: Env): Promise<Response> {
  assertDemoEnabled(env);
  return json(await seedDemo(env.DB), 201);
}

export async function reset(request: Request, env: Env): Promise<Response> {
  assertDemoEnabled(env);
  const body = await readJson(request);
  return json(await resetDemo(env.DB, confirmFlag(body)));
}
