import type { ApiErrorBody } from "../../shared/types";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const error = readError(payload);
    if (response.status === 401 && !path.startsWith("/api/auth/login") && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new ApiClientError(response.status, error.code, error.message);
  }
  return payload as T;
}

function readError(payload: unknown): { code: string; message: string } {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as ApiErrorBody).error;
    return {
      code: error?.code || "REQUEST_FAILED",
      message: error?.message || "The request failed.",
    };
  }
  return { code: "REQUEST_FAILED", message: "The request failed." };
}
