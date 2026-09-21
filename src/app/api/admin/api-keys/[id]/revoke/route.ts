export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/b2b/apiKeys";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "api_keys.manage");

    const apiKey = await revokeApiKey(params.id, user!.id);

    await writeAuditLog({ actorUserId: user!.id, action: "api_key.revoke", targetType: "ApiKey", targetId: apiKey.id });

    return NextResponse.json({ apiKey: { id: apiKey.id, status: apiKey.status } });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST api-key revoke");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
