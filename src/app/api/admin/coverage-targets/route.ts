export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { setCoverageTarget } from "@/lib/admin/coverageTargets";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  cityId: z.string().uuid(),
  categoryId: z.string().uuid(),
  targetCount: z.number().int().min(0),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "coverage_targets.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid coverage target.", parsed.error.flatten());

    const target = await setCoverageTarget({ ...parsed.data, updatedByUserId: user!.id });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "coverage_target.set",
      targetType: "CityCoverageTarget",
      targetId: target.id,
      metadata: { cityId: target.cityId, categoryId: target.categoryId, targetCount: target.targetCount },
    });

    return NextResponse.json({ target }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST coverage targets");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
