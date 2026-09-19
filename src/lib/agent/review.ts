import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import { createPlace, type CreatePlaceInput } from "@/lib/places/placeService";
import { recalculateReputation } from "./reputation";
import { activityForTaskType, getActiveRewardRule } from "@/lib/rewards/rewardRules";
import { recordPendingEarning } from "@/lib/rewards/wallet";
import { logger } from "@/lib/logging/logger";

const REVIEW_FRESHNESS_DAYS = 90; // spec Section 30

export type ReviewDecision = "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";

export interface ReviewSubmissionInput {
  submissionId: string;
  reviewedByUserId: string;
  decision: ReviewDecision;
  reviewNotes?: string;
}

/**
 * Applies a reviewer's decision on a TaskSubmission. See DECISIONS.md D12
 * for exactly which task types get a real Place update here vs. just a
 * recorded verification event.
 */
export async function reviewSubmission(input: ReviewSubmissionInput) {
  const submission = await db.taskSubmission.findUnique({
    where: { id: input.submissionId },
    include: { task: true },
  });
  if (!submission) throw new AppError("NOT_FOUND", "Submission not found.");
  if (submission.reviewStatus !== "PENDING") {
    throw new AppError("CONFLICT", `This submission was already reviewed (status: ${submission.reviewStatus}).`);
  }

  if (input.decision === "NEEDS_MORE_INFO") {
    const updated = await db.taskSubmission.update({
      where: { id: submission.id },
      data: {
        reviewStatus: "NEEDS_MORE_INFO",
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
      },
    });
    // Let the agent act again rather than leaving the task stuck as SUBMITTED.
    await db.task.update({ where: { id: submission.taskId }, data: { status: "ASSIGNED" } });
    return updated;
  }

  if (input.decision === "REJECTED") {
    const updated = await db.taskSubmission.update({
      where: { id: submission.id },
      data: {
        reviewStatus: "REJECTED",
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
      },
    });
    await db.task.update({ where: { id: submission.taskId }, data: { status: "REJECTED" } });
    await recalculateReputation(submission.agentUserId);
    return updated;
  }

  // APPROVED
  const task = submission.task;

  const source = await db.source.create({
    data: {
      type: "LOCAL_DATA_AGENT",
      label: "Local Data Agent field submission",
      contributorUserId: submission.agentUserId,
      baseReliability: 70,
    },
  });

  if (task.type === "NEW_PLACE") {
    if (!submission.proposedPlaceData) {
      throw new AppError("VALIDATION_ERROR", "Submission has no proposed place data to create a place from.");
    }
    const proposed = submission.proposedPlaceData as unknown as CreatePlaceInput;
    const { place } = await createPlace({ ...proposed, createdByUserId: submission.agentUserId });

    await db.place.update({
      where: { id: place.id },
      data: {
        verificationStatus: "DIGITALLY_VERIFIED",
        lastVerifiedAt: new Date(),
        nextReviewAt: addDays(new Date(), REVIEW_FRESHNESS_DAYS),
      },
    });
    await db.placeSource.create({ data: { placeId: place.id, sourceId: source.id, confidence: 70 } });
    await db.task.update({ where: { id: task.id }, data: { status: "APPROVED", placeId: place.id } });
  } else if (task.placeId) {
    const nowPlus90 = addDays(new Date(), REVIEW_FRESHNESS_DAYS);

    if (task.type === "FIELD_VERIFICATION") {
      await db.place.update({
        where: { id: task.placeId },
        data: { verificationStatus: "FIELD_VERIFIED", lastVerifiedAt: new Date(), nextReviewAt: nowPlus90 },
      });
    } else if (task.type === "CLOSURE") {
      await db.place.update({ where: { id: task.placeId }, data: { verificationStatus: "CLOSED" } });
    } else {
      // CONTACT_VERIFICATION / LOCATION_VERIFICATION / UPDATE / PHOTO_TASK —
      // see DECISIONS.md D12: record the verification event, refresh
      // freshness, but don't attempt automated field-level updates yet.
      await db.place.update({
        where: { id: task.placeId },
        data: { lastVerifiedAt: new Date(), nextReviewAt: nowPlus90 },
      });
    }

    await db.placeSource.create({
      data: {
        placeId: task.placeId,
        sourceId: source.id,
        claim: `${task.type} task completed`,
        confidence: 70,
      },
    });
    await db.placeChangeHistory.create({
      data: {
        placeId: task.placeId,
        fieldChanged: task.type === "CLOSURE" ? "verificationStatus" : "lastVerifiedAt",
        newValue: { taskId: task.id, submissionId: submission.id },
        changedByUserId: input.reviewedByUserId,
        reason: `Approved agent submission for ${task.type} task`,
        approvalStatus: "APPROVED",
      },
    });
    await db.task.update({ where: { id: task.id }, data: { status: "APPROVED" } });
  }

  const updatedSubmission = await db.taskSubmission.update({
    where: { id: submission.id },
    data: {
      reviewStatus: "APPROVED",
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes,
    },
  });

  const updatedReputation = await recalculateReputation(submission.agentUserId);

  // Spec Section 34/36: never pay simply because a form was submitted, and
  // never create new earnings for a SUSPENDED (fraud-flagged) account.
  // A missing/inactive RewardRule for this activity means no automatic
  // payment — that's a safe default, not a bug, per D17/D19/D20.
  if (updatedReputation.fraudStatus === "SUSPENDED") {
    logger.warn(
      { agentUserId: submission.agentUserId, taskId: task.id },
      "Skipped earning creation: agent reputation is SUSPENDED"
    );
  } else {
    const activity = activityForTaskType(task.type);
    const rule = activity ? await getActiveRewardRule(activity) : null;
    if (rule) {
      await recordPendingEarning({
        userId: submission.agentUserId,
        amountMinorUnits: rule.amountMinorUnits,
        currency: rule.currency,
        taskId: task.id,
        submissionId: submission.id,
      });
    }
  }

  return updatedSubmission;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
