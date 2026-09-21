export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { recordBonus } from "@/lib/rewards/wallet";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  userId: z.string().uuid(),
  amountMinorUnits: z.number().int().positive(),
  currency: z.string().length(3),
  reason: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "earnings.approve");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid bonus request.", parsed.error.flatten());

    const transaction = await recordBonus({ ...parsed.data, grantedByUserId: user!.id });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "wallet.bonus",
      targetType: "WalletTransaction",
      targetId: transaction.id,
      metadata: { userId: parsed.data.userId, amountMinorUnits: parsed.data.amountMinorUnits, reason: parsed.data.reason },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in wallet bonus");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
