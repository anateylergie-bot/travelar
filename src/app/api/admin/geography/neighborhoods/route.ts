import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createNeighborhood } from "@/lib/places/geography";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  cityId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cityId = searchParams.get("cityId") ?? undefined;
  const neighborhoods = await db.neighborhood.findMany({ where: cityId ? { cityId } : undefined, orderBy: { name: "asc" } });
  return NextResponse.json({ neighborhoods });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "geography.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid neighborhood data.", parsed.error.flatten());

    const neighborhood = await createNeighborhood(parsed.data);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "geography.neighborhood.create",
      targetType: "Neighborhood",
      targetId: neighborhood.id,
      metadata: { name: neighborhood.name, cityId: neighborhood.cityId },
    });

    return NextResponse.json({ neighborhood }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/admin/geography/neighborhoods");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
