import { MAX_JSON_BODY_CHARS } from "../shared/constants";
import { isRecord } from "../shared/schemas";
import { applySecurityHeaders } from "./middleware/security";

export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  applySecurityHeaders(responseHeaders);
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_JSON_BODY_CHARS) {
    return null;
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function jsonContentType(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

export function confirmFlag(value: unknown): boolean {
  return isRecord(value) && value.confirm === true;
}
