export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPayout } from "@/lib/rewards/payouts";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  amountMinorUnits: z.number().int().positive(),
  currency: z.string().length(3),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requireAuth(user);

    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = checkRateLimit(`payout-request:${user!.id}`, 5, 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "Too many payout requests. Please try again later.");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid payout request.", parsed.error.flatten());

    const payout = await requestPayout({ userId: user!.id, ...parsed.data });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "payout.request",
      targetType: "Payout",
      targetId: payout.id,
      metadata: { amountMinorUnits: payout.amountMinorUnits, currency: payout.currency },
      ipAddress: ip,
    });

    return NextResponse.json({ payout }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST payout-request");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
