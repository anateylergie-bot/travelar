import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import { findPotentialDuplicates, type NewPlaceInput } from "./duplicateService";
import type { DuplicateSignal } from "./duplicateDetection";

export interface CreatePlaceInput extends NewPlaceInput {
  categoryId: string;
  countryId: string;
  regionId?: string;
  cityId?: string;
  neighborhoodId?: string;
  address?: string;
  description?: string;
  whatsapp?: string;
  email?: string;
  createdByUserId?: string;
}

export interface CreatePlaceResult {
  place: { id: string; name: string; verificationStatus: string };
  potentialDuplicates: DuplicateSignal[];
}

const HIGH_CONFIDENCE_DUPLICATE_SCORE = 70;

/**
 * Creates a place in DRAFT status. Duplicate candidates are always
 * computed and returned to the caller (so a UI can warn "possible
 * existing place found 120m away" per spec Section 24), but a duplicate
 * signal — even a strong one — never blocks creation on its own. Only a
 * human reviewer (Phase 3+ moderation workflow) decides to merge/reject.
 */
export async function createPlace(input: CreatePlaceInput): Promise<CreatePlaceResult> {
  if (input.latitude < -90 || input.latitude > 90) {
    throw new AppError("VALIDATION_ERROR", "Latitude must be between -90 and 90.");
  }
  if (input.longitude < -180 || input.longitude > 180) {
    throw new AppError("VALIDATION_ERROR", "Longitude must be between -180 and 180.");
  }
  if (!input.name || input.name.trim().length < 2) {
    throw new AppError("VALIDATION_ERROR", "Place name must be at least 2 characters.");
  }

  const category = await db.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError("VALIDATION_ERROR", "Unknown category.");

  const country = await db.country.findUnique({ where: { id: input.countryId } });
  if (!country) throw new AppError("VALIDATION_ERROR", "Unknown country.");

  const potentialDuplicates = await findPotentialDuplicates({
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    phone: input.phone,
    website: input.website,
    categoryId: input.categoryId,
  });

  const place = await db.place.create({
    data: {
      name: input.name.trim(),
      categoryId: input.categoryId,
      countryId: input.countryId,
      regionId: input.regionId,
      cityId: input.cityId,
      neighborhoodId: input.neighborhoodId,
      address: input.address,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      website: input.website,
      verificationStatus: "DRAFT",
      createdByUserId: input.createdByUserId,
    },
  });

  await db.placeChangeHistory.create({
    data: {
      placeId: place.id,
      fieldChanged: "*", // whole-record creation
      previousValue: undefined,
      newValue: { name: place.name, latitude: place.latitude, longitude: place.longitude },
      changedByUserId: input.createdByUserId,
      reason: "Initial submission",
      approvalStatus: "AUTO_APPLIED", // creation itself isn't gated; the record starts as DRAFT
    },
  });

  // High-confidence duplicate signals are logged, not blocked — a future
  // moderation-queue phase decides what to do with them. Deliberately not
  // throwing here so we don't silently lose legitimate submissions to a
  // heuristic false positive.
  const strongMatches = potentialDuplicates.filter((d) => d.score >= HIGH_CONFIDENCE_DUPLICATE_SCORE);
  if (strongMatches.length > 0) {
    await db.placeChangeHistory.create({
      data: {
        placeId: place.id,
        fieldChanged: "duplicate_check",
        newValue: strongMatches as unknown as object,
        reason: "Automated duplicate detection flagged possible existing place(s)",
        approvalStatus: "PENDING",
      },
    });
  }

  return {
    place: { id: place.id, name: place.name, verificationStatus: place.verificationStatus },
    potentialDuplicates,
  };
}
