import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertEmergencyNumber } from "@/lib/travel/emergencyNumbers";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  countryId: z.string().uuid(),
  service: z.enum(["GENERAL", "POLICE", "AMBULANCE", "FIRE", "OTHER"]),
  number: z.string().min(2).max(20),
  label: z.string().max(200).optional(),
  sourceDescription: z.string().min(1).max(500),
  sourceUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "emergency_numbers.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid emergency number data.", parsed.error.flatten());

    const record = await upsertEmergencyNumber({ ...parsed.data, updatedByUserId: user!.id });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "emergency_number.upsert",
      targetType: "EmergencyNumber",
      targetId: record.id,
      metadata: { countryId: record.countryId, service: record.service, number: record.number },
    });

    return NextResponse.json({ emergencyNumber: record }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST admin emergency numbers");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
