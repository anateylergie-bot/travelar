// INTEGRATION TEST — requires a real PostgreSQL database.
//
// These were written but NOT executed in the authoring sandbox (no network
// access to a database server there — see PROJECT_AUDIT.md). Run them
// yourself with:
//
//   1. A running Postgres instance, e.g.:
//        docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=postgres postgres:15
//   2. A dedicated test database URL, e.g.:
//        export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/tourist_platform_test"
//   3. Apply the schema:
//        npx prisma migrate deploy
//   4. Run:
//        npm test
//
// If any of these fail, that's real signal to fix — please report back
// what breaks so the code (not the test) can be corrected.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, getUserFromSessionToken, revokeSession } from "@/lib/auth/session";

describe("auth flow (integration, requires live Postgres)", () => {
  const testEmail = `test-${Date.now()}@example.com`;

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: testEmail } });
    await db.$disconnect();
  });

  it("creates a user with a hashed password and a TOURIST role", async () => {
    const passwordHash = await hashPassword("Str0ngPassword");
    const user = await db.user.create({
      data: {
        email: testEmail,
        passwordHash,
        status: "ACTIVE",
        roles: { create: [{ role: "TOURIST" }] },
      },
      include: { roles: true },
    });

    expect(user.email).toBe(testEmail);
    expect(user.passwordHash).not.toBe("Str0ngPassword");
    expect(user.roles.map((r) => r.role)).toContain("TOURIST");

    const ok = await verifyPassword("Str0ngPassword", user.passwordHash);
    expect(ok).toBe(true);
  });

  it("issues a session and resolves it back to the correct user", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: testEmail } });
    const { rawToken } = await createSession({ userId: user.id });

    const resolved = await getUserFromSessionToken(rawToken);
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.roles).toContain("TOURIST");
  });

  it("rejects a revoked session", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: testEmail } });
    const { rawToken } = await createSession({ userId: user.id });

    let resolved = await getUserFromSessionToken(rawToken);
    expect(resolved).not.toBeNull();

    await revokeSession(rawToken, "test-revocation");

    resolved = await getUserFromSessionToken(rawToken);
    expect(resolved).toBeNull();
  });

  it("rejects a garbage/unknown session token", async () => {
    const resolved = await getUserFromSessionToken("not-a-real-token");
    expect(resolved).toBeNull();
  });
});
