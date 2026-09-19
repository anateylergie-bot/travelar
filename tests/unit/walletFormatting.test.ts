import { describe, it, expect } from "vitest";
import { formatMinorUnits } from "@/lib/rewards/wallet";

describe("formatMinorUnits", () => {
  it("converts minor units to a 2-decimal major-unit string", () => {
    expect(formatMinorUnits(500, "GHS")).toBe("GHS 5.00");
  });

  it("handles zero", () => {
    expect(formatMinorUnits(0, "GHS")).toBe("GHS 0.00");
  });

  it("handles amounts under 100 minor units correctly", () => {
    expect(formatMinorUnits(5, "GHS")).toBe("GHS 0.05");
  });

  it("rounds to 2 decimal places for odd minor-unit values", () => {
    expect(formatMinorUnits(1234, "USD")).toBe("USD 12.34");
  });
});
