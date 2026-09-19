import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import type { Prisma } from "@prisma/client";

// Spec Section 29: owners can update phone, website, hours, description,
// services, photos, pricing. Photos go through the agent evidence
// pipeline (Phase 3), not this one — out of scope here, documented gap.
const EDITABLE_FIELDS = [
  "phone",
  "whatsapp",
  "email",
  "website",
  "description",
  "openingHours",
  "priceRange",
  "paymentMethods",
  "services",
  "amenities",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

export type BusinessChanges = Partial<Record<EditableField, unknown>>;

export function validateChanges(changes: BusinessChanges): void {
  const keys = Object.keys(changes);
  if (keys.length === 0) {
    throw new AppError("VALIDATION_ERROR", "At least one field change is required.");
  }
  for (const key of keys) {
    if (!EDITABLE_FIELDS.includes(key as EditableField)) {
      throw new AppError("VALIDATION_ERROR", `Field "${key}" cannot be updated through this endpoint.`);
    }
  }
}

export async function submitUpdateRequest(params: {
  placeId: string;
  requestedByUserId: string;
  changes: BusinessChanges;
}) {
  validateChanges(params.changes);

  const place = await db.place.findUnique({ where: { id: params.placeId } });
  if (!place) throw new AppError("NOT_FOUND", "Place not found.");

  // Ownership check — independent of role, per spec Section 84. Holding
  // the BUSINESS_OWNER role is necessary but not sufficient; the caller
  // must own THIS specific place.
  if (place.ownerUserId !== params.requestedByUserId) {
    throw new AppError("UNAUTHORIZED", "You do not own this place.");
  }

  return db.businessUpdateRequest.create({
    data: {
      placeId: params.placeId,
      requestedByUserId: params.requestedByUserId,
      changes: params.changes as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });
}

export type UpdateDecision = "APPROVED" | "REJECTED";

export async function reviewUpdateRequest(params: {
  requestId: string;
  reviewedByUserId: string;
  decision: UpdateDecision;
  reviewNotes?: string;
}) {
  const request = await db.businessUpdateRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new AppError("NOT_FOUND", "Update request not found.");
  if (request.status !== "PENDING") {
    throw new AppError("CONFLICT", `This request was already reviewed (status: ${request.status}).`);
  }

  if (params.decision === "REJECTED") {
    return db.businessUpdateRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUserId: params.reviewedByUserId,
        reviewNotes: params.reviewNotes,
      },
    });
  }

  const place = await db.place.findUnique({ where: { id: request.placeId } });
  if (!place) throw new AppError("NOT_FOUND", "Place no longer exists.");

  const changes = request.changes as BusinessChanges;
  const placeRecord = place as unknown as Record<string, unknown>;

  return db.$transaction(async (tx) => {
    for (const [field, newValue] of Object.entries(changes)) {
      const previousValue = placeRecord[field];
      await tx.placeChangeHistory.create({
        data: {
          placeId: request.placeId,
          fieldChanged: field,
          previousValue: previousValue as Prisma.InputJsonValue,
          newValue: newValue as Prisma.InputJsonValue,
          changedByUserId: params.reviewedByUserId,
          reason: "Business owner update request approved",
          approvalStatus: "APPROVED",
        },
      });
    }

    await tx.place.update({ where: { id: request.placeId }, data: changes as Prisma.PlaceUpdateInput });

    return tx.businessUpdateRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: params.reviewedByUserId,
        reviewNotes: params.reviewNotes,
      },
    });
  });
}

export async function listUpdateRequests(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
  return db.businessUpdateRequest.findMany({ where: { status }, orderBy: { submittedAt: "asc" }, take: 100 });
}
