import { describe, it, expect } from "vitest";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";

describe("AppError", () => {
  it("maps VALIDATION_ERROR to HTTP 400", () => {
    const err = new AppError("VALIDATION_ERROR", "bad input");
    expect(err.status).toBe(400);
    expect(statusForError(err)).toBe(400);
  });

  it("maps UNAUTHENTICATED to HTTP 401 and UNAUTHORIZED to 403", () => {
    expect(new AppError("UNAUTHENTICATED", "x").status).toBe(401);
    expect(new AppError("UNAUTHORIZED", "x").status).toBe(403);
  });

  it("never leaks stack trace or internal message for unknown errors", () => {
    const body = toApiErrorBody(new Error("some internal db connection string leaked"));
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("db connection string");
  });

  it("preserves the AppError's own message and details for known errors", () => {
    const err = new AppError("VALIDATION_ERROR", "Email is required", { field: "email" });
    const body = toApiErrorBody(err);
    expect(body.error.message).toBe("Email is required");
    expect(body.error.details).toEqual({ field: "email" });
  });

  it("defaults unknown thrown values to 500 status", () => {
    expect(statusForError("not an error object")).toBe(500);
  });
});
