import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import { checkRateLimit } from "@/lib/rateLimit";
import type { ApiKey } from "@prisma/client";

// Mirrors the session-token pattern from Phase 1 (see DECISIONS.md D34):
// only a hash is ever stored; the raw key is returned exactly once, at
// creation, and is unrecoverable afterward.

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export const API_KEY_SCOPES = ["places.read", "categories.read", "geography.read"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export async function createApiKey(params: {
  label: string;
  organizationName?: string;
  scopes: ApiKeyScope[];
  rateLimitPerMinute?: number;
  expiresAt?: Date;
  createdByUserId: string;
}): Promise<{ apiKey: ApiKey; rawKey: string }> {
  if (params.scopes.length === 0) {
    throw new AppError("VALIDATION_ERROR", "At least one scope is required.");
  }
  const invalidScopes = params.scopes.filter((s) => !API_KEY_SCOPES.includes(s));
  if (invalidScopes.length > 0) {
    throw new AppError("VALIDATION_ERROR", `Unknown scope(s): ${invalidScopes.join(", ")}`);
  }

  const rawKey = `tpk_${randomBytes(32).toString("hex")}`; // "tourist platform key" prefix, purely cosmetic
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  const apiKey = await db.apiKey.create({
    data: {
      keyHash,
      keyPrefix,
      label: params.label,
      organizationName: params.organizationName,
      scopes: params.scopes,
      rateLimitPerMinute: params.rateLimitPerMinute ?? 60,
      expiresAt: params.expiresAt,
      createdByUserId: params.createdByUserId,
    },
  });

  return { apiKey, rawKey };
}

export async function revokeApiKey(apiKeyId: string, revokedByUserId: string) {
  const key = await db.apiKey.findUnique({ where: { id: apiKeyId } });
  if (!key) throw new AppError("NOT_FOUND", "API key not found.");
  if (key.status === "REVOKED") throw new AppError("CONFLICT", "This key is already revoked.");

  return db.apiKey.update({
    where: { id: apiKeyId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId },
  });
}

export async function listApiKeys() {
  // Never returns keyHash to the caller — see the select clause.
  return db.apiKey.findMany({
    select: {
      id: true,
      keyPrefix: true,
      label: true,
      organizationName: true,
      scopes: true,
      status: true,
      rateLimitPerMinute: true,
      requestCount: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Validates a raw API key from an incoming request, checks it has the
 * required scope, enforces its per-key rate limit, and records usage.
 * Throws AppError on any failure — callers just need to await this and
 * proceed on success.
 */
export async function requireApiKeyAccess(rawKey: string | null, requiredScope: ApiKeyScope): Promise<ApiKey> {
  if (!rawKey) {
    throw new AppError("UNAUTHENTICATED", "Missing API key. Provide it via the Authorization: Bearer header.");
  }

  const keyHash = hashKey(rawKey);
  const apiKey = await db.apiKey.findUnique({ where: { keyHash } });

  if (!apiKey) throw new AppError("UNAUTHENTICATED", "Invalid API key.");
  if (apiKey.status === "REVOKED") throw new AppError("UNAUTHORIZED", "This API key has been revoked.");
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
    throw new AppError("UNAUTHORIZED", "This API key has expired.");
  }
  if (!apiKey.scopes.includes(requiredScope)) {
    throw new AppError("UNAUTHORIZED", `This API key does not have the "${requiredScope}" scope.`);
  }

  const { allowed } = checkRateLimit(`apikey:${apiKey.id}`, apiKey.rateLimitPerMinute, 60 * 1000);
  if (!allowed) {
    throw new AppError("RATE_LIMITED", "API key rate limit exceeded.");
  }

  // Fire-and-forget usage tracking — never block or fail the actual
  // request on a usage-counter update.
  db.apiKey
    .update({ where: { id: apiKey.id }, data: { requestCount: { increment: 1 }, lastUsedAt: new Date() } })
    .catch(() => undefined);

  return apiKey;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
