import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import { createTask } from "@/lib/agent/tasks";
import type { ReportReason, TaskType } from "@prisma/client";

// Spec Section 68 + DECISIONS.md D25: reviewing a report can spin up a
// real verification Task rather than a separate ad hoc "fix" mechanism.
// Some reasons don't map to a field task at all (duplicates and offensive
// content are handled by direct admin/moderator judgment, not a site
// visit) — those return null and reviewing them can only DISMISS or
// resolve directly, never auto-create a task.
const REASON_TO_TASK_TYPE: Record<ReportReason, TaskType | null> = {
  WRONG_PHONE: "CONTACT_VERIFICATION",
  CLOSED_BUSINESS: "CLOSURE",
  WRONG_LOCATION: "LOCATION_VERIFICATION",
  WRONG_HOURS: "UPDATE",
  DUPLICATE: null,
  MISLEADING_INFORMATION: "UPDATE",
  UNSAFE_INFORMATION: "FIELD_VERIFICATION",
  INCORRECT_CATEGORY: "UPDATE",
  OFFENSIVE_CONTENT: null,
  OTHER: "UPDATE",
};

export function taskTypeForReportReason(reason: ReportReason): TaskType | null {
  return REASON_TO_TASK_TYPE[reason];
}

export async function submitReport(params: {
  placeId: string;
  reporterUserId: string;
  reason: ReportReason;
  details?: string;
}) {
  const place = await db.place.findUnique({ where: { id: params.placeId } });
  if (!place) throw new AppError("NOT_FOUND", "Place not found.");

  return db.report.create({
    data: {
      placeId: params.placeId,
      reporterUserId: params.reporterUserId,
      reason: params.reason,
      details: params.details,
      status: "PENDING",
    },
  });
}

export type ReportReviewDecision = "CREATE_VERIFICATION_TASK" | "DISMISS";

export async function reviewReport(params: {
  reportId: string;
  reviewedByUserId: string;
  decision: ReportReviewDecision;
  resolutionNotes?: string;
}) {
  const report = await db.report.findUnique({ where: { id: params.reportId } });
  if (!report) throw new AppError("NOT_FOUND", "Report not found.");
  if (report.status !== "PENDING") {
    throw new AppError("CONFLICT", `This report was already reviewed (status: ${report.status}).`);
  }

  if (params.decision === "DISMISS") {
    return db.report.update({
      where: { id: report.id },
      data: {
        status: "DISMISSED",
        reviewedAt: new Date(),
        reviewedByUserId: params.reviewedByUserId,
        resolutionNotes: params.resolutionNotes,
      },
    });
  }

  const taskType = taskTypeForReportReason(report.reason);
  if (!taskType) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Reports with reason ${report.reason} cannot auto-create a verification task — dismiss or resolve manually instead.`
    );
  }

  const task = await createTask({
    type: taskType,
    title: `Verify report: ${report.reason}`,
    instructions: report.details ?? undefined,
    placeId: report.placeId,
    createdByUserId: params.reviewedByUserId,
  });

  return db.report.update({
    where: { id: report.id },
    data: {
      status: "TASK_CREATED",
      linkedTaskId: task.id,
      reviewedAt: new Date(),
      reviewedByUserId: params.reviewedByUserId,
      resolutionNotes: params.resolutionNotes,
    },
  });
}

/**
 * Manually mark a report resolved once its linked task's outcome (or
 * other investigation) satisfies it. Not automatic — a human decides a
 * report is actually settled, per spec Section 68's REVIEW step being a
 * deliberate human judgment, not just a status mirror of the task.
 */
export async function resolveReport(params: { reportId: string; reviewedByUserId: string; resolutionNotes?: string }) {
  const report = await db.report.findUnique({ where: { id: params.reportId } });
  if (!report) throw new AppError("NOT_FOUND", "Report not found.");
  if (report.status === "RESOLVED" || report.status === "DISMISSED") {
    throw new AppError("CONFLICT", `This report is already ${report.status}.`);
  }

  return db.report.update({
    where: { id: report.id },
    data: {
      status: "RESOLVED",
      reviewedAt: new Date(),
      reviewedByUserId: params.reviewedByUserId,
      resolutionNotes: params.resolutionNotes,
    },
  });
}

export async function listReports(status: "PENDING" | "TASK_CREATED" | "RESOLVED" | "DISMISSED" = "PENDING") {
  return db.report.findMany({ where: { status }, orderBy: { createdAt: "asc" }, take: 100 });
}
