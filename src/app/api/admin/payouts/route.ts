export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";
import type { PayoutStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "payouts.manage");

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as PayoutStatus | null) ?? "PENDING";

    const payouts = await db.payout.findMany({
      where: { status },
      orderBy: { requestedAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ payouts });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET admin payouts");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
