import { NextResponse } from "next/server";
import { z } from "zod";
import { listRewardRules, upsertRewardRule } from "@/lib/rewards/rewardRules";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const ACTIVITIES = [
  "NEW_PLACE_APPROVED",
  "FIELD_VERIFICATION_APPROVED",
  "UPDATE_APPROVED",
  "CLOSURE_CONFIRMED",
  "CONTACT_VERIFICATION_APPROVED",
  "LOCATION_VERIFICATION_APPROVED",
  "PHOTO_TASK_APPROVED",
] as const;

const Schema = z.object({
  activity: z.enum(ACTIVITIES),
  amountMinorUnits: z.number().int().min(0),
  currency: z.string().length(3),
});

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "rewards.manage");
    const rules = await listRewardRules();
    return NextResponse.json({ rules });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET reward rules");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "rewards.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid reward rule.", parsed.error.flatten());

    const rule = await upsertRewardRule({ ...parsed.data, updatedByUserId: user!.id });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "reward_rule.upsert",
      targetType: "RewardRule",
      targetId: rule.id,
      metadata: { activity: rule.activity, amountMinorUnits: rule.amountMinorUnits, currency: rule.currency },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST reward rules");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
