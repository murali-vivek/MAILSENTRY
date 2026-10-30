export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toPublicError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof ApiError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  const text = error instanceof Error ? error.message : "";
  if (/quota|exceeded|storage limit|too many requests|daily limit/i.test(text)) {
    return {
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "The service is temporarily unavailable because a usage quota was reached. Try again after the quota resets.",
    };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "The request could not be completed." };
}
