import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createRegion } from "@/lib/places/geography";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  countryId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryId = searchParams.get("countryId") ?? undefined;
  const regions = await db.region.findMany({ where: countryId ? { countryId } : undefined, orderBy: { name: "asc" } });
  return NextResponse.json({ regions });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "geography.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid region data.", parsed.error.flatten());

    const region = await createRegion(parsed.data);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "geography.region.create",
      targetType: "Region",
      targetId: region.id,
      metadata: { name: region.name, countryId: region.countryId },
    });

    return NextResponse.json({ region }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/admin/geography/regions");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
