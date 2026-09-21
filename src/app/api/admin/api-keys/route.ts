export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiKey, listApiKeys, API_KEY_SCOPES } from "@/lib/b2b/apiKeys";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  label: z.string().min(1).max(200),
  organizationName: z.string().max(200).optional(),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
  rateLimitPerMinute: z.number().int().positive().max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "api_keys.manage");
    const apiKeys = await listApiKeys();
    return NextResponse.json({ apiKeys });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET admin api-keys");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "api_keys.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid API key request.", parsed.error.flatten());

    const { apiKey, rawKey } = await createApiKey({
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      createdByUserId: user!.id,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "api_key.create",
      targetType: "ApiKey",
      targetId: apiKey.id,
      metadata: { label: apiKey.label, scopes: apiKey.scopes },
    });

    // The raw key is returned ONLY in this response, ONLY this once — see
    // DECISIONS.md D34. It is not recoverable after this.
    return NextResponse.json(
      { apiKey: { id: apiKey.id, keyPrefix: apiKey.keyPrefix, label: apiKey.label, scopes: apiKey.scopes }, rawKey },
      { status: 201 }
    );
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST admin api-keys");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
