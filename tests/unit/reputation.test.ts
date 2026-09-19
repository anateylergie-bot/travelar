import { describe, it, expect } from "vitest";
import { computeAccuracyScore, computeAgentLevel } from "@/lib/agent/reputation";

describe("computeAccuracyScore", () => {
  it("returns 0 when there is no reviewed work at all", () => {
    expect(computeAccuracyScore({ approvedCount: 0, rejectedCount: 0 })).toBe(0);
  });

  it("returns 1 when everything was approved", () => {
    expect(computeAccuracyScore({ approvedCount: 10, rejectedCount: 0 })).toBe(1);
  });

  it("returns 0 when everything was rejected", () => {
    expect(computeAccuracyScore({ approvedCount: 0, rejectedCount: 10 })).toBe(0);
  });

  it("computes a correct ratio for mixed outcomes", () => {
    expect(computeAccuracyScore({ approvedCount: 3, rejectedCount: 1 })).toBe(0.75);
  });
});

describe("computeAgentLevel", () => {
  it("starts everyone at LEVEL_1_NEW with no history", () => {
    expect(computeAgentLevel({ approvedCount: 0, rejectedCount: 0, accuracyScore: 0 })).toBe("LEVEL_1_NEW");
  });

  it("promotes to LEVEL_2_CONTRIBUTOR after the first approval", () => {
    expect(computeAgentLevel({ approvedCount: 1, rejectedCount: 0, accuracyScore: 1 })).toBe("LEVEL_2_CONTRIBUTOR");
  });

  it("does not promote past LEVEL_2 with low accuracy despite volume", () => {
    // 20 reviewed, but only 50% accuracy — should not reach LEVEL_3 (needs >=80%)
    const level = computeAgentLevel({ approvedCount: 10, rejectedCount: 10, accuracyScore: 0.5 });
    expect(level).toBe("LEVEL_2_CONTRIBUTOR");
  });

  it("reaches LEVEL_3_VERIFIED_CONTRIBUTOR with sufficient volume and accuracy", () => {
    const level = computeAgentLevel({ approvedCount: 18, rejectedCount: 2, accuracyScore: 0.9 });
    expect(level).toBe("LEVEL_3_VERIFIED_CONTRIBUTOR");
  });

  it("reaches LEVEL_4_SENIOR_VERIFIER with higher volume and accuracy", () => {
    const level = computeAgentLevel({ approvedCount: 70, rejectedCount: 5, accuracyScore: 70 / 75 });
    expect(level).toBe("LEVEL_4_SENIOR_VERIFIER");
  });

  it("reaches LEVEL_5_CITY_DATA_LEAD only with very high volume and accuracy", () => {
    const level = computeAgentLevel({ approvedCount: 195, rejectedCount: 5, accuracyScore: 0.975 });
    expect(level).toBe("LEVEL_5_CITY_DATA_LEAD");
  });

  it("does not reach LEVEL_5 with high volume but insufficient accuracy", () => {
    const level = computeAgentLevel({ approvedCount: 150, rejectedCount: 50, accuracyScore: 0.75 });
    expect(level).not.toBe("LEVEL_5_CITY_DATA_LEAD");
  });
});
