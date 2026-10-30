import { api } from "./client";

export type SessionResponse = { authenticated: true; demoEnabled: boolean };

export function getSession(): Promise<SessionResponse> {
  return api<SessionResponse>("/api/auth/session");
}

export function login(password: string): Promise<{ ok: true }> {
  return api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
}

export function logout(): Promise<{ ok: true }> {
  return api("/api/auth/logout", { method: "POST" });
}
