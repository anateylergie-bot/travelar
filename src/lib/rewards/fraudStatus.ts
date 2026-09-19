import { db } from "@/lib/db";
import type { AgentFraudStatus } from "@prisma/client";

// Spec Section 36: "flag suspicious activity... do not automatically
// accuse users of fraud." These thresholds are a documented starting
// heuristic (see DECISIONS.md D20) — not a validated fraud model. They
// gate NEW earnings/payouts; they never reverse existing approved money
// automatically, and "SUSPENDED" is presented as "under review," not as
// an accusation.

export interface FraudInputs {
  approvedCount: number;
  rejectedCount: number;
  accuracyScore: number;
}

export function evaluateFraudStatus(inputs: FraudInputs): AgentFraudStatus {
  const totalReviewed = inputs.approvedCount + inputs.rejectedCount;

  // Not enough history to judge either way.
  if (totalReviewed < 3) return "NORMAL";

  // Clear, sustained low quality at real volume — flag for suspension,
  // pending human investigation (never auto-labelled "fraud").
  if (totalReviewed >= 5 && inputs.accuracyScore < 0.3) return "SUSPENDED";

  // Moderate concern — surfaced for review, earnings still flow normally
  // at this tier; only SUSPENDED blocks money movement.
  if (inputs.rejectedCount >= 3 && inputs.accuracyScore < 0.5) return "REVIEW";

  return "NORMAL";
}

export async function getFraudStatus(userId: string): Promise<AgentFraudStatus> {
  const reputation = await db.agentReputation.findUnique({ where: { userId } });
  return reputation?.fraudStatus ?? "NORMAL";
}
