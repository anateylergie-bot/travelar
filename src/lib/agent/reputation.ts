import { db } from "@/lib/db";
import type { AgentLevel } from "@prisma/client";
import { evaluateFraudStatus } from "@/lib/rewards/fraudStatus";

// Spec Section 33: "base reputation primarily on measurable data quality."
// Level thresholds below are a documented starting point (see DECISIONS.md
// if you want to add a D-entry tuning these later) — not a claim they're
// perfectly calibrated, since no real submission data exists yet to tune
// against.

export interface ReputationInputs {
  approvedCount: number;
  rejectedCount: number;
}

export function computeAccuracyScore(inputs: ReputationInputs): number {
  const total = inputs.approvedCount + inputs.rejectedCount;
  if (total === 0) return 0;
  return inputs.approvedCount / total;
}

export function computeAgentLevel(inputs: ReputationInputs & { accuracyScore: number }): AgentLevel {
  const totalReviewed = inputs.approvedCount + inputs.rejectedCount;

  if (totalReviewed === 0) return "LEVEL_1_NEW";

  // Level 5 — City Data Lead: sustained high volume + high accuracy.
  if (totalReviewed >= 200 && inputs.accuracyScore >= 0.95) return "LEVEL_5_CITY_DATA_LEAD";

  // Level 4 — Senior Verifier.
  if (totalReviewed >= 75 && inputs.accuracyScore >= 0.9) return "LEVEL_4_SENIOR_VERIFIER";

  // Level 3 — Verified Contributor.
  if (totalReviewed >= 20 && inputs.accuracyScore >= 0.8) return "LEVEL_3_VERIFIED_CONTRIBUTOR";

  // Level 2 — Contributor: has at least some approved work.
  if (inputs.approvedCount >= 1) return "LEVEL_2_CONTRIBUTOR";

  return "LEVEL_1_NEW";
}

/**
 * Recalculates and persists an agent's reputation from their actual
 * TaskSubmission review history. Never called with fabricated counts —
 * always derived from real rows (spec Section 157's "never fake earnings"
 * principle applies equally to reputation).
 */
export async function recalculateReputation(agentUserId: string) {
  const [approvedCount, rejectedCount] = await Promise.all([
    db.taskSubmission.count({ where: { agentUserId, reviewStatus: "APPROVED" } }),
    db.taskSubmission.count({ where: { agentUserId, reviewStatus: "REJECTED" } }),
  ]);

  const accuracyScore = computeAccuracyScore({ approvedCount, rejectedCount });
  const level = computeAgentLevel({ approvedCount, rejectedCount, accuracyScore });
  const fraudStatus = evaluateFraudStatus({ approvedCount, rejectedCount, accuracyScore });

  return db.agentReputation.upsert({
    where: { userId: agentUserId },
    update: {
      accuracyScore,
      completedTasksCount: approvedCount + rejectedCount,
      approvedSubmissionsCount: approvedCount,
      rejectedSubmissionsCount: rejectedCount,
      level,
      fraudStatus,
    },
    create: {
      userId: agentUserId,
      accuracyScore,
      completedTasksCount: approvedCount + rejectedCount,
      approvedSubmissionsCount: approvedCount,
      rejectedSubmissionsCount: rejectedCount,
      level,
      fraudStatus,
    },
  });
}
