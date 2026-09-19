import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import type { EmergencyServiceType } from "@prisma/client";

export async function upsertEmergencyNumber(params: {
  countryId: string;
  service: EmergencyServiceType;
  number: string;
  label?: string;
  sourceDescription: string;
  sourceUrl?: string;
  updatedByUserId: string;
}) {
  if (!params.sourceDescription || params.sourceDescription.trim().length === 0) {
    // Spec Section 155: never fabricated contact info — a source is
    // mandatory, not optional, for anything this safety-critical.
    throw new AppError("VALIDATION_ERROR", "sourceDescription is required for emergency numbers.");
  }
  if (!/^[\d+\-\s]{2,20}$/.test(params.number)) {
    throw new AppError("VALIDATION_ERROR", "Invalid emergency number format.");
  }

  const country = await db.country.findUnique({ where: { id: params.countryId } });
  if (!country) throw new AppError("VALIDATION_ERROR", "Unknown country.");

  const existing = await db.emergencyNumber.findFirst({
    where: { countryId: params.countryId, service: params.service, number: params.number },
  });

  if (existing) {
    return db.emergencyNumber.update({
      where: { id: existing.id },
      data: {
        label: params.label,
        sourceDescription: params.sourceDescription,
        sourceUrl: params.sourceUrl,
        lastVerifiedAt: new Date(),
        updatedByUserId: params.updatedByUserId,
      },
    });
  }

  return db.emergencyNumber.create({
    data: {
      countryId: params.countryId,
      service: params.service,
      number: params.number,
      label: params.label,
      sourceDescription: params.sourceDescription,
      sourceUrl: params.sourceUrl,
      lastVerifiedAt: new Date(),
      updatedByUserId: params.updatedByUserId,
    },
  });
}

export async function listEmergencyNumbers(countryId: string) {
  return db.emergencyNumber.findMany({ where: { countryId }, orderBy: { service: "asc" } });
}
