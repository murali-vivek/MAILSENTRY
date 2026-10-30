import { ApiError } from "./errors";

export function applySecurityHeaders(headers: Headers): void {
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  );
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) {
    throw new ApiError(403, "CROSS_ORIGIN", "Cross-origin requests are not allowed.");
  }
}

export function logRequest(entry: {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
}): void {
  const safe = {
    level: "info",
    requestId: entry.requestId,
    method: entry.method,
    route: entry.route,
    status: entry.status,
    durationMs: entry.durationMs,
  };
  console.log(JSON.stringify(safe));
}
