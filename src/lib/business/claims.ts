import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";

const REVIEW_FRESHNESS_DAYS = 90;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function submitClaim(params: {
  placeId: string;
  claimantUserId: string;
  justification?: string;
  evidenceDescription?: string;
}) {
  const place = await db.place.findUnique({ where: { id: params.placeId } });
  if (!place) throw new AppError("NOT_FOUND", "Place not found.");

  if (place.ownerUserId) {
    // See DECISIONS.md D24 — no automatic dispute queue; a place that
    // already has an approved owner cannot receive a new claim through
    // this endpoint.
    throw new AppError("CONFLICT", "This place already has a verified owner.");
  }

  const existingPending = await db.businessClaim.findFirst({
    where: { placeId: params.placeId, claimantUserId: params.claimantUserId, status: "PENDING" },
  });
  if (existingPending) {
    throw new AppError("CONFLICT", "You already have a pending claim on this place.");
  }

  return db.businessClaim.create({
    data: {
      placeId: params.placeId,
      claimantUserId: params.claimantUserId,
      justification: params.justification,
      evidenceDescription: params.evidenceDescription,
      status: "PENDING",
    },
  });
}

export type ClaimDecision = "APPROVED" | "REJECTED";

export async function reviewClaim(params: {
  claimId: string;
  reviewedByUserId: string;
  decision: ClaimDecision;
  rejectionReason?: string;
}) {
  const claim = await db.businessClaim.findUnique({ where: { id: params.claimId } });
  if (!claim) throw new AppError("NOT_FOUND", "Claim not found.");
  if (claim.status !== "PENDING") {
    throw new AppError("CONFLICT", `This claim was already reviewed (status: ${claim.status}).`);
  }

  if (params.decision === "REJECTED") {
    if (!params.rejectionReason) {
      throw new AppError("VALIDATION_ERROR", "A rejection reason is required.");
    }
    return db.businessClaim.update({
      where: { id: claim.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUserId: params.reviewedByUserId,
        rejectionReason: params.rejectionReason,
      },
    });
  }

  // APPROVED — re-check the place hasn't been claimed by someone else in
  // the meantime (race between submission and review).
  const place = await db.place.findUnique({ where: { id: claim.placeId } });
  if (!place) throw new AppError("NOT_FOUND", "Place no longer exists.");
  if (place.ownerUserId && place.ownerUserId !== claim.claimantUserId) {
    throw new AppError("CONFLICT", "This place was claimed by someone else in the meantime.");
  }

  const source = await db.source.create({
    data: {
      type: "BUSINESS_OWNER",
      label: "Verified business owner claim",
      contributorUserId: claim.claimantUserId,
      baseReliability: 80,
    },
  });

  return db.$transaction(async (tx) => {
    await tx.userRole.upsert({
      where: { userId_role: { userId: claim.claimantUserId, role: "BUSINESS_OWNER" } },
      update: {},
      create: { userId: claim.claimantUserId, role: "BUSINESS_OWNER", grantedBy: params.reviewedByUserId },
    });

    await tx.place.update({
      where: { id: claim.placeId },
      data: {
        ownerUserId: claim.claimantUserId,
        verificationStatus: "OWNER_VERIFIED",
        lastVerifiedAt: new Date(),
        nextReviewAt: addDays(new Date(), REVIEW_FRESHNESS_DAYS),
      },
    });

    await tx.placeSource.create({ data: { placeId: claim.placeId, sourceId: source.id, confidence: 80 } });

    await tx.placeChangeHistory.create({
      data: {
        placeId: claim.placeId,
        fieldChanged: "ownerUserId",
        newValue: { ownerUserId: claim.claimantUserId },
        changedByUserId: params.reviewedByUserId,
        reason: "Business claim approved",
        approvalStatus: "APPROVED",
      },
    });

    return tx.businessClaim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedByUserId: params.reviewedByUserId },
    });
  });
}

export async function listClaims(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
  return db.businessClaim.findMany({ where: { status }, orderBy: { submittedAt: "asc" }, take: 100 });
}
