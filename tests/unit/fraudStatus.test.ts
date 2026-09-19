import { describe, it, expect } from "vitest";
import { evaluateFraudStatus } from "@/lib/rewards/fraudStatus";

describe("evaluateFraudStatus", () => {
  it("is NORMAL with no history", () => {
    expect(evaluateFraudStatus({ approvedCount: 0, rejectedCount: 0, accuracyScore: 0 })).toBe("NORMAL");
  });

  it("is NORMAL with very little history even if accuracy looks bad", () => {
    // Only 2 total reviewed — not enough signal to judge.
    expect(evaluateFraudStatus({ approvedCount: 0, rejectedCount: 2, accuracyScore: 0 })).toBe("NORMAL");
  });

  it("is NORMAL for a solid contributor", () => {
    expect(evaluateFraudStatus({ approvedCount: 18, rejectedCount: 2, accuracyScore: 0.9 })).toBe("NORMAL");
  });

  it("is REVIEW for moderate rejection volume with poor accuracy", () => {
    expect(evaluateFraudStatus({ approvedCount: 3, rejectedCount: 3, accuracyScore: 0.45 })).toBe("REVIEW");
  });

  it("is SUSPENDED for sustained very poor accuracy at real volume", () => {
    expect(evaluateFraudStatus({ approvedCount: 1, rejectedCount: 9, accuracyScore: 0.1 })).toBe("SUSPENDED");
  });

  it("does not suspend a small sample even with 0% accuracy", () => {
    // Only 2 reviewed total — below the volume floor for SUSPENDED.
    expect(evaluateFraudStatus({ approvedCount: 0, rejectedCount: 2, accuracyScore: 0 })).not.toBe("SUSPENDED");
  });

  it("prioritizes SUSPENDED over REVIEW when both conditions are met", () => {
    const result = evaluateFraudStatus({ approvedCount: 1, rejectedCount: 9, accuracyScore: 0.1 });
    expect(result).toBe("SUSPENDED");
  });
});
