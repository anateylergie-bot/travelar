import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";
import type { RoleName } from "@/lib/rbac/roles";

export const SESSION_COOKIE_NAME = "session_token";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  roles: RoleName[];
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function ttlHours(): number {
  return Number(process.env.SESSION_TTL_HOURS ?? 720);
}

/**
 * Creates a new session for a user. Returns the RAW token — this is the
 * only time the raw value exists; only its hash is persisted.
 */
export async function createSession(params: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours() * 60 * 60 * 1000);

  await db.session.create({
    data: {
      userId: params.userId,
      tokenHash,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Validates a raw session token from a cookie and returns the
 * authenticated user with their roles, or null if invalid/expired/revoked.
 */
export async function getUserFromSessionToken(rawToken: string | undefined | null): Promise<AuthenticatedUser | null> {
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { roles: true } } },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.status === "SUSPENDED" || session.user.status === "DEACTIVATED") return null;

  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    roles: session.user.roles.map((r) => r.role) as RoleName[],
  };
}

export async function revokeSession(rawToken: string, reason = "logout"): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}
