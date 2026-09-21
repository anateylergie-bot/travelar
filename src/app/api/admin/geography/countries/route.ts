export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createCountry } from "@/lib/places/geography";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  name: z.string().trim().min(1).max(100),
  isoCode2: z.string().length(2),
  isoCode3: z.string().length(3).optional(),
});

export async function GET() {
  const countries = await db.country.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ countries });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "geography.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid country data.", parsed.error.flatten());

    const country = await createCountry(parsed.data);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "geography.country.create",
      targetType: "Country",
      targetId: country.id,
      metadata: { name: country.name, isoCode2: country.isoCode2 },
    });

    return NextResponse.json({ country }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/admin/geography/countries");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
