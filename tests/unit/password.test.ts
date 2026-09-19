import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/auth/password";

describe("validatePasswordStrength", () => {
  it("rejects passwords shorter than 10 characters", () => {
    expect(validatePasswordStrength("Ab1").valid).toBe(false);
  });

  it("rejects passwords without a number", () => {
    expect(validatePasswordStrength("NoNumbersHere").valid).toBe(false);
  });

  it("rejects passwords without mixed case", () => {
    expect(validatePasswordStrength("alllowercase1").valid).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(validatePasswordStrength("Str0ngPassword").valid).toBe(true);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("produces a hash that verifies correctly against the original password", async () => {
    const hash = await hashPassword("Str0ngPassword");
    expect(hash).not.toEqual("Str0ngPassword");
    await expect(verifyPassword("Str0ngPassword", hash)).resolves.toBe(true);
  });

  it("fails verification against the wrong password", async () => {
    const hash = await hashPassword("Str0ngPassword");
    await expect(verifyPassword("WrongPassword1", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same input (random salt)", async () => {
    const hash1 = await hashPassword("Str0ngPassword");
    const hash2 = await hashPassword("Str0ngPassword");
    expect(hash1).not.toEqual(hash2);
  });
});
