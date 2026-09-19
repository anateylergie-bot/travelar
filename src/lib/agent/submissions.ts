import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import { hasCompletedRequiredTraining } from "./training";
import { photoStorage } from "@/lib/storage/localFilesystemAdapter";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB — spec Section 95: validate file size
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface SubmitTaskInput {
  taskId: string;
  agentUserId: string;
  checklist?: {
    placeExists?: boolean;
    nameMatches?: boolean;
    locationMatches?: boolean;
    appearsOperational?: boolean;
    contactVerified?: boolean;
    openingInfoChecked?: boolean;
  };
  notes?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracyMeters?: number;
  proposedPlaceData?: Record<string, unknown>; // for NEW_PLACE tasks
  photos?: Array<{ buffer: Buffer; filename: string; mimeType: string }>;
}

export async function submitTask(input: SubmitTaskInput) {
  const task = await db.task.findUnique({ where: { id: input.taskId } });
  if (!task) throw new AppError("NOT_FOUND", "Task not found.");
  if (task.assignedAgentId !== input.agentUserId) {
    throw new AppError("UNAUTHORIZED", "This task is not assigned to you.");
  }
  if (task.status !== "ASSIGNED") {
    throw new AppError("CONFLICT", `Task cannot be submitted from status ${task.status}.`);
  }

  const trained = await hasCompletedRequiredTraining(input.agentUserId, task.type);
  if (!trained) {
    throw new AppError(
      "UNAUTHORIZED",
      `You must complete the required training modules for ${task.type} tasks before submitting.`
    );
  }

  if (task.type === "NEW_PLACE" && !input.proposedPlaceData) {
    throw new AppError("VALIDATION_ERROR", "proposedPlaceData is required for NEW_PLACE tasks.");
  }

  if (input.gpsLat !== undefined && (input.gpsLat < -90 || input.gpsLat > 90)) {
    throw new AppError("VALIDATION_ERROR", "Invalid GPS latitude.");
  }
  if (input.gpsLng !== undefined && (input.gpsLng < -180 || input.gpsLng > 180)) {
    throw new AppError("VALIDATION_ERROR", "Invalid GPS longitude.");
  }

  for (const photo of input.photos ?? []) {
    if (photo.buffer.byteLength > MAX_PHOTO_BYTES) {
      throw new AppError("VALIDATION_ERROR", `Photo ${photo.filename} exceeds the 10MB limit.`);
    }
    if (!ALLOWED_MIME_TYPES.includes(photo.mimeType)) {
      throw new AppError("VALIDATION_ERROR", `Photo ${photo.filename} has an unsupported file type.`);
    }
  }

  const submission = await db.taskSubmission.create({
    data: {
      taskId: input.taskId,
      agentUserId: input.agentUserId,
      placeExists: input.checklist?.placeExists,
      nameMatches: input.checklist?.nameMatches,
      locationMatches: input.checklist?.locationMatches,
      appearsOperational: input.checklist?.appearsOperational,
      contactVerified: input.checklist?.contactVerified,
      openingInfoChecked: input.checklist?.openingInfoChecked,
      notes: input.notes,
      gpsLat: input.gpsLat,
      gpsLng: input.gpsLng,
      gpsAccuracyMeters: input.gpsAccuracyMeters,
      proposedPlaceData: input.proposedPlaceData as any,
    },
  });

  // Uploaded sequentially and after the submission row exists — if a
  // photo upload fails partway, the submission itself is still valid and
  // reviewable; it just has fewer evidence photos than intended. We don't
  // want a storage hiccup to silently discard an otherwise-complete field
  // report (spec Section 122: never silently lose user data).
  for (const photo of input.photos ?? []) {
    const stored = await photoStorage.upload(photo);
    await db.evidence.create({
      data: {
        submissionId: submission.id,
        storageKey: stored.storageKey,
        url: stored.url,
        mimeType: photo.mimeType,
        fileSizeBytes: photo.buffer.byteLength,
        // exifStrippedAt intentionally left null — see DECISIONS.md D13.
      },
    });
  }

  await db.task.update({ where: { id: input.taskId }, data: { status: "SUBMITTED" } });

  return submission;
}
