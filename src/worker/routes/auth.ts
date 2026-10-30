import { isRecord } from "../../shared/schemas";
import type { Env } from "../env";
import { json, jsonContentType, readJson } from "../http";
import {
  assertConfigured,
  cookieSecure,
  passwordsMatch,
  sessionCookie,
  signSession,
} from "../middleware/auth";
import { demoEnabled } from "../services/demo";

export async function login(request: Request, env: Env): Promise<Response> {
  assertConfigured(env);
  let password = "";
  if (jsonContentType(request)) {
    const body = await readJson(request);
    if (isRecord(body) && typeof body.password === "string") password = body.password;
  }
  const matches = await passwordsMatch(password, env.MAILSENTRY_ACCESS_PASSWORD);
  if (!matches) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sign in failed." } }, 401);
  }
  const token = await signSession(env.MAILSENTRY_SESSION_SECRET);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token, cookieSecure(request, env)) });
}

export function logout(request: Request, env: Env): Response {
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", cookieSecure(request, env), 0) });
}

export function session(env: Env): Response {
  return json({ authenticated: true, demoEnabled: demoEnabled(env) });
}
