import { COOKIE_NAME, MIN_PASSWORD_LENGTH, MIN_SECRET_LENGTH, SESSION_TTL_SECONDS } from "../../shared/constants";
import type { Env } from "../env";
import { ApiError } from "./errors";

export function assertConfigured(env: Env): void {
  if ((env.MAILSENTRY_ACCESS_PASSWORD ?? "").length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(500, "NOT_CONFIGURED", "The application is not configured.");
  }
  if ((env.MAILSENTRY_SESSION_SECRET ?? "").length < MIN_SECRET_LENGTH) {
    throw new ApiError(500, "NOT_CONFIGURED", "The application is not configured.");
  }
}

export async function passwordsMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided.slice(0, 1024))),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}

export async function signSession(secret: string, now = Date.now()): Promise<string> {
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ v: 1, exp: now + SESSION_TTL_SECONDS * 1000 })));
  const signature = bytesToBase64Url(await hmac(secret, body));
  return `${body}.${signature}`;
}

export async function verifySession(secret: string, token: string, now = Date.now()): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  if (!body || !signature) return false;
  const expected = await hmac(secret, body);
  const actual = base64UrlToBytes(signature);
  if (!actual || !timingSafeEqual(actual, expected)) return false;
  const payloadBytes = base64UrlToBytes(body);
  if (!payloadBytes) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { v?: unknown; exp?: unknown };
    return payload.v === 1 && typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_TTL_SECONDS): string {
  const parts = [`${COOKIE_NAME}=${token}`, "HttpOnly", "SameSite=Strict", "Path=/", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function requireSession(request: Request, env: Env): Promise<void> {
  assertConfigured(env);
  const token = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  if (!token || !(await verifySession(env.MAILSENTRY_SESSION_SECRET, token))) {
    throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  }
}

export function cookieSecure(request: Request, env: Env): boolean {
  return new URL(request.url).protocol === "https:" || env.APP_ENV === "production";
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}
