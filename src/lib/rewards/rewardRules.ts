import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import type { RewardActivityType, TaskType } from "@prisma/client";

// Spec Section 34: "Do not hard-code reward values." Every amount comes
// from a RewardRule row, managed via the API by Finance Administrator/
// Super Admin — never a constant in code.

const TASK_TYPE_TO_ACTIVITY: Record<TaskType, RewardActivityType | null> = {
  NEW_PLACE: "NEW_PLACE_APPROVED",
  FIELD_VERIFICATION: "FIELD_VERIFICATION_APPROVED",
  UPDATE: "UPDATE_APPROVED",
  CLOSURE: "CLOSURE_CONFIRMED",
  CONTACT_VERIFICATION: "CONTACT_VERIFICATION_APPROVED",
  LOCATION_VERIFICATION: "LOCATION_VERIFICATION_APPROVED",
  PHOTO_TASK: "PHOTO_TASK_APPROVED",
};

export function activityForTaskType(taskType: TaskType): RewardActivityType | null {
  return TASK_TYPE_TO_ACTIVITY[taskType];
}

export async function getActiveRewardRule(activity: RewardActivityType) {
  const rule = await db.rewardRule.findUnique({ where: { activity } });
  if (!rule || !rule.active) return null;
  return rule;
}

export async function upsertRewardRule(params: {
  activity: RewardActivityType;
  amountMinorUnits: number;
  currency: string;
  updatedByUserId: string;
}) {
  if (params.amountMinorUnits < 0) {
    throw new AppError("VALIDATION_ERROR", "Reward amount cannot be negative.");
  }
  if (!/^[A-Z]{3}$/.test(params.currency)) {
    throw new AppError("VALIDATION_ERROR", "Currency must be a 3-letter ISO 4217 code (e.g. GHS).");
  }

  return db.rewardRule.upsert({
    where: { activity: params.activity },
    update: {
      amountMinorUnits: params.amountMinorUnits,
      currency: params.currency,
      updatedByUserId: params.updatedByUserId,
      active: true,
    },
    create: {
      activity: params.activity,
      amountMinorUnits: params.amountMinorUnits,
      currency: params.currency,
      updatedByUserId: params.updatedByUserId,
    },
  });
}

export async function deactivateRewardRule(activity: RewardActivityType, updatedByUserId: string) {
  return db.rewardRule.update({ where: { activity }, data: { active: false, updatedByUserId } });
}

export async function listRewardRules() {
  return db.rewardRule.findMany({ orderBy: { activity: "asc" } });
}
