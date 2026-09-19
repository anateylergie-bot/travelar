import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import type { TaskType } from "@prisma/client";

export interface CreateTaskInput {
  type: TaskType;
  title: string;
  instructions?: string;
  placeId?: string;
  cityId?: string;
  categoryId?: string;
  createdByUserId: string;
  dueAt?: Date;
}

const TASK_TYPES_REQUIRING_PLACE: TaskType[] = [
  "UPDATE",
  "FIELD_VERIFICATION",
  "CLOSURE",
  "CONTACT_VERIFICATION",
  "LOCATION_VERIFICATION",
  "PHOTO_TASK",
];

export async function createTask(input: CreateTaskInput) {
  if (TASK_TYPES_REQUIRING_PLACE.includes(input.type) && !input.placeId) {
    throw new AppError("VALIDATION_ERROR", `Task type ${input.type} requires an existing placeId.`);
  }
  if (input.placeId) {
    const place = await db.place.findUnique({ where: { id: input.placeId } });
    if (!place) throw new AppError("VALIDATION_ERROR", "Unknown place.");
  }

  return db.task.create({
    data: {
      type: input.type,
      title: input.title,
      instructions: input.instructions,
      placeId: input.placeId,
      cityId: input.cityId,
      categoryId: input.categoryId,
      createdByUserId: input.createdByUserId,
      dueAt: input.dueAt,
      status: "OPEN",
    },
  });
}

/**
 * Open tasks available to a given agent, optionally filtered by city.
 * Does not consider "skill"/"workload" weighting yet (spec Section 22
 * lists several assignment factors) — Phase 3 ships simple city/category
 * filtering; smarter assignment ranking is a documented follow-up.
 */
export async function listAvailableTasks(params: { cityId?: string; categoryId?: string; type?: TaskType }) {
  return db.task.findMany({
    where: {
      status: "OPEN",
      cityId: params.cityId,
      categoryId: params.categoryId,
      type: params.type,
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
}

export async function listAgentTasks(agentUserId: string) {
  return db.task.findMany({
    where: { assignedAgentId: agentUserId },
    orderBy: { assignedAt: "desc" },
    include: { submissions: true },
  });
}

export async function acceptTask(taskId: string, agentUserId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError("NOT_FOUND", "Task not found.");
  if (task.status !== "OPEN") throw new AppError("CONFLICT", "This task is no longer available.");

  return db.task.update({
    where: { id: taskId },
    data: { status: "ASSIGNED", assignedAgentId: agentUserId, assignedAt: new Date() },
  });
}

/**
 * Spec Section 22/91: agents can reject unsafe tasks with no reputation
 * penalty (see DECISIONS.md D14 — this is deliberately separate from
 * TaskSubmission.reviewStatus, which does feed reputation).
 */
export async function rejectTask(taskId: string, agentUserId: string, reason: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError("NOT_FOUND", "Task not found.");
  if (task.assignedAgentId !== agentUserId) {
    throw new AppError("UNAUTHORIZED", "You can only reject a task assigned to you.");
  }

  return db.task.update({
    where: { id: taskId },
    data: { status: "REJECTED_BY_AGENT", rejectionReason: reason, assignedAgentId: null },
  });
}
