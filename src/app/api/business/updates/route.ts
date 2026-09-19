import { NextResponse } from "next/server";
import { z } from "zod";
import { submitUpdateRequest } from "@/lib/business/updates";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  placeId: z.string().uuid(),
  changes: z.record(z.unknown()),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "business.updates.submit");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid update request.", parsed.error.flatten());

    const updateRequest = await submitUpdateRequest({
      placeId: parsed.data.placeId,
      requestedByUserId: user!.id,
      changes: parsed.data.changes,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "business_update.submit",
      targetType: "BusinessUpdateRequest",
      targetId: updateRequest.id,
      metadata: { placeId: parsed.data.placeId, fields: Object.keys(parsed.data.changes) },
    });

    return NextResponse.json({ updateRequest }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/business/updates");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
