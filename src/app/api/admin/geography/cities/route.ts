import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createCity } from "@/lib/places/geography";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  regionId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  centroidLat: z.number().min(-90).max(90).optional(),
  centroidLng: z.number().min(-180).max(180).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionId = searchParams.get("regionId") ?? undefined;
  const cities = await db.city.findMany({ where: regionId ? { regionId } : undefined, orderBy: { name: "asc" } });
  return NextResponse.json({ cities });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "geography.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid city data.", parsed.error.flatten());

    const city = await createCity(parsed.data);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "geography.city.create",
      targetType: "City",
      targetId: city.id,
      metadata: { name: city.name, regionId: city.regionId },
    });

    return NextResponse.json({ city }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/admin/geography/cities");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
