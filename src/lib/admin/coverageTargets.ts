import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";

const VERIFIED_STATUSES = ["DIGITALLY_VERIFIED", "FIELD_VERIFIED", "OWNER_VERIFIED", "COMMUNITY_VERIFIED"] as const;

export async function setCoverageTarget(params: {
  cityId: string;
  categoryId: string;
  targetCount: number;
  updatedByUserId: string;
}) {
  if (params.targetCount < 0) throw new AppError("VALIDATION_ERROR", "targetCount cannot be negative.");

  const city = await db.city.findUnique({ where: { id: params.cityId } });
  if (!city) throw new AppError("VALIDATION_ERROR", "Unknown city.");
  const category = await db.category.findUnique({ where: { id: params.categoryId } });
  if (!category) throw new AppError("VALIDATION_ERROR", "Unknown category.");

  return db.cityCoverageTarget.upsert({
    where: { cityId_categoryId: { cityId: params.cityId, categoryId: params.categoryId } },
    update: { targetCount: params.targetCount, updatedByUserId: params.updatedByUserId },
    create: {
      cityId: params.cityId,
      categoryId: params.categoryId,
      targetCount: params.targetCount,
      updatedByUserId: params.updatedByUserId,
    },
  });
}

export interface CoverageRow {
  categoryId: string;
  categoryName: string;
  target: number;
  current: number;
  verified: number;
  gap: number;
}

/**
 * Spec Section 39/90: TARGET / CURRENT / VERIFIED / GAP per category for
 * a city. Only categories with an explicit target are included — a city
 * with no configured targets returns an empty list, not zeros for every
 * category that happens to exist.
 */
export async function getCityCoverageDashboard(cityId: string): Promise<CoverageRow[]> {
  const targets = await db.cityCoverageTarget.findMany({
    where: { cityId },
    include: { category: true },
  });

  const rows: CoverageRow[] = [];
  for (const t of targets) {
    const [current, verified] = await Promise.all([
      db.place.count({ where: { cityId, categoryId: t.categoryId, verificationStatus: { notIn: ["REJECTED", "CLOSED"] } } }),
      db.place.count({ where: { cityId, categoryId: t.categoryId, verificationStatus: { in: [...VERIFIED_STATUSES] } } }),
    ]);

    rows.push({
      categoryId: t.categoryId,
      categoryName: t.category.name,
      target: t.targetCount,
      current,
      verified,
      gap: Math.max(0, t.targetCount - current),
    });
  }

  return rows;
}
