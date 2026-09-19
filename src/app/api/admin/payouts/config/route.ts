import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayoutConfig, setPayoutConfig } from "@/lib/rewards/payoutConfig";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  minimumWithdrawalMinorUnits: z.number().int().min(0),
  supportedCurrencies: z.array(z.string().length(3)).min(1),
  feeMinorUnits: z.number().int().min(0),
});

export async function GET() {
  try {
    const config = await getPayoutConfig();
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "payouts.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid payout configuration.", parsed.error.flatten());

    const config = await setPayoutConfig(parsed.data, user!.id);

    await writeAuditLog({ actorUserId: user!.id, action: "payout_config.update", metadata: config as any });

    return NextResponse.json({ config });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in PUT payout config");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
