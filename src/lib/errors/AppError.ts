// Spec Section 119: every API must return structured errors, never a
// stack trace to the client, and log technical detail internally only.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "CSRF_FAILED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  UNAUTHORIZED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  CSRF_FAILED: 403,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  details?: unknown;
  status: number;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.status = STATUS_BY_CODE[code];
  }
}

/** Shape returned to clients. Never includes stack traces or internal detail. */
export function toApiErrorBody(err: unknown): { error: { code: ErrorCode; message: string; details?: unknown } } {
  if (err instanceof AppError) {
    return { error: { code: err.code, message: err.message, details: err.details } };
  }
  // Unknown/unexpected error: never leak internals to the client.
  return { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } };
}

export function statusForError(err: unknown): number {
  if (err instanceof AppError) return err.status;
  return 500;
}
