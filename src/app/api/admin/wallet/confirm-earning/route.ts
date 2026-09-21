export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmEarning } from "@/lib/rewards/wallet";
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
  submissionId: z.string().uuid().optional(),
});

// Spec Section 37 role split / DECISIONS.md D19: this is a SEPARATE step
// from the data-quality review in Phase 3 — a Finance Administrator moves
// an already-approved-for-quality earning from pending to payable.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "earnings.approve");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid confirmation request.", parsed.error.flatten());

    const transaction = await confirmEarning({ ...parsed.data, confirmedByUserId: user!.id });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "earning.confirm",
      targetType: "WalletTransaction",
      targetId: transaction.id,
      metadata: { userId: parsed.data.userId, amountMinorUnits: parsed.data.amountMinorUnits },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in confirm-earning");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
