export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSafetyAlert } from "@/lib/travel/safetyAlerts";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  countryId: z.string().uuid(),
  cityId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  severity: z.enum(["INFO", "ADVISORY", "WARNING"]),
  sourceDescription: z.string().min(1).max(500),
  sourceUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "safety_alerts.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid safety alert data.", parsed.error.flatten());

    const alert = await createSafetyAlert({
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      createdByUserId: user!.id,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "safety_alert.create",
      targetType: "SafetyAlert",
      targetId: alert.id,
      metadata: { countryId: alert.countryId, severity: alert.severity },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST admin safety alerts");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
