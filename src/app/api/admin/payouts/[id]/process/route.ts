import { NextResponse } from "next/server";
import { z } from "zod";
import { processPayout } from "@/lib/rewards/payouts";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  decision: z.enum(["PAID", "FAILED"]),
  reference: z.string().max(200).optional(),
  failureReason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "payouts.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid payout decision.", parsed.error.flatten());

    const payout = await processPayout({
      payoutId: params.id,
      processedByUserId: user!.id,
      ...parsed.data,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "payout.process",
      targetType: "Payout",
      targetId: payout.id,
      metadata: { decision: parsed.data.decision },
    });

    return NextResponse.json({ payout });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in payout process");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
