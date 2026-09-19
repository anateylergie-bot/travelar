import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import type { SafetyAlertSeverity } from "@prisma/client";

// Spec Section 52 + DECISIONS.md D32: only reliable, human-verified
// sources — no open submission, no automated scraping.
export async function createSafetyAlert(params: {
  countryId: string;
  cityId?: string;
  title: string;
  description: string;
  severity: SafetyAlertSeverity;
  sourceDescription: string;
  sourceUrl?: string;
  expiresAt?: Date;
  createdByUserId: string;
}) {
  if (!params.sourceDescription || params.sourceDescription.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "sourceDescription is required — never publish an unsourced alert.");
  }

  const country = await db.country.findUnique({ where: { id: params.countryId } });
  if (!country) throw new AppError("VALIDATION_ERROR", "Unknown country.");

  return db.safetyAlert.create({
    data: {
      countryId: params.countryId,
      cityId: params.cityId,
      title: params.title,
      description: params.description,
      severity: params.severity,
      sourceDescription: params.sourceDescription,
      sourceUrl: params.sourceUrl,
      expiresAt: params.expiresAt,
      createdByUserId: params.createdByUserId,
    },
  });
}

export async function listActiveSafetyAlerts(params: { countryId: string; cityId?: string }) {
  const now = new Date();

  // Country-wide alerts (cityId: null) always apply; city-specific alerts
  // only apply when that city was asked for. Built explicitly rather than
  // passing `params.cityId` directly into a Prisma filter, since Prisma
  // treats `undefined` as "don't filter this field" — not "match null" —
  // which would have silently matched every city's alerts regardless of
  // what was requested.
  const cityCondition = params.cityId ? { OR: [{ cityId: params.cityId }, { cityId: null }] } : { cityId: null };

  // Two separate conditions each use their own OR — combined via AND so
  // one doesn't silently overwrite the other's `OR` key in the same
  // object literal (a real bug caught while writing this).
  const freshnessCondition = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };

  return db.safetyAlert.findMany({
    where: {
      countryId: params.countryId,
      startsAt: { lte: now },
      AND: [cityCondition, freshnessCondition],
    },
    orderBy: { severity: "desc" },
  });
}
