import { describe, it, expect } from "vitest";
import { validateChanges } from "@/lib/business/updates";
import { AppError } from "@/lib/errors/AppError";

describe("validateChanges", () => {
  it("rejects an empty change set", () => {
    expect(() => validateChanges({})).toThrow(AppError);
  });

  it("accepts a single allowed field", () => {
    expect(() => validateChanges({ phone: "0241234567" })).not.toThrow();
  });

  it("accepts multiple allowed fields at once", () => {
    expect(() =>
      validateChanges({ phone: "0241234567", website: "https://example.com", description: "Great place" })
    ).not.toThrow();
  });

  it("rejects a field not on the editable allowlist", () => {
    expect(() => validateChanges({ verificationStatus: "FIELD_VERIFIED" } as any)).toThrow(AppError);
  });

  it("rejects an attempt to change ownerUserId via this path", () => {
    // This is the exact kind of privilege-escalation attempt the
    // allowlist exists to block (spec Section 83/84).
    expect(() => validateChanges({ ownerUserId: "some-other-user-id" } as any)).toThrow(AppError);
  });

  it("rejects latitude/longitude changes through this endpoint", () => {
    // Coordinate changes should go through field verification, not a
    // self-service owner update.
    expect(() => validateChanges({ latitude: 1.23 } as any)).toThrow(AppError);
  });
});
