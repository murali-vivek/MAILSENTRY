import type { Env } from "./env";
import { json } from "./http";
import { requireSession } from "./middleware/auth";
import { toPublicError } from "./middleware/errors";
import { assertSameOrigin, logRequest } from "./middleware/security";
import * as authRoutes from "./routes/auth";
import * as analysisRoutes from "./routes/analyses";
import * as demoRoutes from "./routes/demo";
import { getDashboard } from "./routes/dashboard";
import { health } from "./routes/health";
import { listRules } from "./routes/rules";
import * as vendorRoutes from "./routes/vendors";

const UUID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";

type Handler = (request: Request, env: Env, params: string[]) => Promise<Response> | Response;

const routes: Array<{ method: string; pattern: RegExp; auth: boolean; mutate: boolean; handler: Handler }> = [
  { method: "GET", pattern: /^\/api\/health$/, auth: false, mutate: false, handler: () => health() },
  { method: "POST", pattern: /^\/api\/auth\/login$/, auth: false, mutate: true, handler: (request, env) => authRoutes.login(request, env) },
  { method: "POST", pattern: /^\/api\/auth\/logout$/, auth: false, mutate: true, handler: (request, env) => authRoutes.logout(request, env) },
  { method: "GET", pattern: /^\/api\/auth\/session$/, auth: true, mutate: false, handler: (_request, env) => authRoutes.session(env) },
  { method: "GET", pattern: /^\/api\/dashboard$/, auth: true, mutate: false, handler: (_request, env) => getDashboard(env) },
  { method: "POST", pattern: /^\/api\/analyses$/, auth: true, mutate: true, handler: (request, env) => analysisRoutes.createAnalysis(request, env) },
  { method: "GET", pattern: /^\/api\/analyses$/, auth: true, mutate: false, handler: (request, env) => analysisRoutes.list(request, env) },
  { method: "GET", pattern: new RegExp(`^\\/api\\/analyses\\/${UUID}$`, "i"), auth: true, mutate: false, handler: (_request, env, params) => analysisRoutes.detail(params[0] ?? "", env) },
  { method: "PATCH", pattern: new RegExp(`^\\/api\\/analyses\\/${UUID}\\/review$`, "i"), auth: true, mutate: true, handler: (request, env, params) => analysisRoutes.review(request, params[0] ?? "", env) },
  { method: "POST", pattern: new RegExp(`^\\/api\\/analyses\\/${UUID}\\/add-to-vendor-history$`, "i"), auth: true, mutate: true, handler: (request, env, params) => analysisRoutes.addHistory(request, params[0] ?? "", env) },
  { method: "GET", pattern: /^\/api\/vendors$/, auth: true, mutate: false, handler: (_request, env) => vendorRoutes.list(env) },
  { method: "POST", pattern: /^\/api\/vendors$/, auth: true, mutate: true, handler: (request, env) => vendorRoutes.create(request, env) },
  { method: "GET", pattern: new RegExp(`^\\/api\\/vendors\\/${UUID}$`, "i"), auth: true, mutate: false, handler: (_request, env, params) => vendorRoutes.detail(params[0] ?? "", env) },
  { method: "PATCH", pattern: new RegExp(`^\\/api\\/vendors\\/${UUID}$`, "i"), auth: true, mutate: true, handler: (request, env, params) => vendorRoutes.update(request, params[0] ?? "", env) },
  { method: "GET", pattern: new RegExp(`^\\/api\\/vendors\\/${UUID}\\/history$`, "i"), auth: true, mutate: false, handler: (request, env, params) => vendorRoutes.history(request, params[0] ?? "", env) },
  { method: "GET", pattern: /^\/api\/rules$/, auth: true, mutate: false, handler: () => listRules() },
  { method: "GET", pattern: /^\/api\/demo\/status$/, auth: true, mutate: false, handler: (_request, env) => demoRoutes.status(env) },
  { method: "POST", pattern: /^\/api\/demo\/seed$/, auth: true, mutate: true, handler: (_request, env) => demoRoutes.seed(env) },
  { method: "POST", pattern: /^\/api\/demo\/reset$/, auth: true, mutate: true, handler: (request, env) => demoRoutes.reset(request, env) },
];

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const started = performance.now();
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  let status = 500;
  try {
    const response = await dispatch(request, env, url);
    status = response.status;
    return finalize(response, requestId);
  } catch (error) {
    const mapped = toPublicError(error);
    status = mapped.status;
    return finalize(json({ error: { code: mapped.code, message: mapped.message } }, mapped.status), requestId);
  } finally {
    logRequest({
      requestId,
      method: request.method,
      route: url.pathname,
      status,
      durationMs: Math.round(performance.now() - started),
    });
  }
}

async function dispatch(request: Request, env: Env, url: URL): Promise<Response> {
  const route = routes.find((candidate) => candidate.method === request.method && candidate.pattern.test(url.pathname));
  if (!route) return json({ error: { code: "NOT_FOUND", message: "That API route does not exist." } }, 404);
  if (route.mutate) assertSameOrigin(request);
  if (route.auth) await requireSession(request, env);
  const match = url.pathname.match(route.pattern);
  return route.handler(request, env, match?.slice(1) ?? []);
}

function finalize(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
