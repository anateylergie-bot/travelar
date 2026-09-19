import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  it("allows requests up to the max within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
  });

  it("blocks requests beyond the max within the window", () => {
    const key = `test-${Math.random()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(false);
  });

  it("resets the count after the window elapses", async () => {
    const key = `test-${Math.random()}`;
    checkRateLimit(key, 1, 20);
    expect(checkRateLimit(key, 1, 20).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(checkRateLimit(key, 1, 20).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });
});
