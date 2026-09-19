import bcrypt from "bcryptjs";

const COST = Number(process.env.BCRYPT_COST ?? 12);

// Basic strength floor. Real UX for password requirements belongs in the
// UI; this is the server-side backstop that must hold regardless of what
// the client sends (spec Section 83).
const MIN_LENGTH = 10;

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return { valid: false, reason: `Password must be at least ${MIN_LENGTH} characters.` };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      reason: "Password must include uppercase, lowercase, and a number.",
    };
  }
  return { valid: true };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
