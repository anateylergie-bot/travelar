import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";

// Spec Section 89: Country -> Region -> City -> Neighborhood -> Categories.
// Kept as plain CRUD-ish functions since this is low-volume admin data,
// not something needing the duplicate-detection machinery Places need.

export async function createCountry(input: { name: string; isoCode2: string; isoCode3?: string }) {
  const isoCode2 = input.isoCode2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(isoCode2)) {
    throw new AppError("VALIDATION_ERROR", "isoCode2 must be exactly 2 letters (ISO 3166-1 alpha-2).");
  }
  const existing = await db.country.findUnique({ where: { isoCode2 } });
  if (existing) throw new AppError("CONFLICT", `Country with code ${isoCode2} already exists.`);

  return db.country.create({ data: { name: input.name, isoCode2, isoCode3: input.isoCode3?.toUpperCase() } });
}

export async function createRegion(input: { countryId: string; name: string }) {
  const country = await db.country.findUnique({ where: { id: input.countryId } });
  if (!country) throw new AppError("VALIDATION_ERROR", "Unknown country.");

  const existing = await db.region.findUnique({
    where: { countryId_name: { countryId: input.countryId, name: input.name } },
  });
  if (existing) throw new AppError("CONFLICT", `Region "${input.name}" already exists in this country.`);

  return db.region.create({ data: { countryId: input.countryId, name: input.name } });
}

export async function createCity(input: { regionId: string; name: string; centroidLat?: number; centroidLng?: number }) {
  const region = await db.region.findUnique({ where: { id: input.regionId } });
  if (!region) throw new AppError("VALIDATION_ERROR", "Unknown region.");

  const existing = await db.city.findUnique({ where: { regionId_name: { regionId: input.regionId, name: input.name } } });
  if (existing) throw new AppError("CONFLICT", `City "${input.name}" already exists in this region.`);

  return db.city.create({
    data: {
      regionId: input.regionId,
      name: input.name,
      centroidLat: input.centroidLat,
      centroidLng: input.centroidLng,
    },
  });
}

export async function createNeighborhood(input: { cityId: string; name: string }) {
  const city = await db.city.findUnique({ where: { id: input.cityId } });
  if (!city) throw new AppError("VALIDATION_ERROR", "Unknown city.");

  const existing = await db.neighborhood.findUnique({
    where: { cityId_name: { cityId: input.cityId, name: input.name } },
  });
  if (existing) throw new AppError("CONFLICT", `Neighborhood "${input.name}" already exists in this city.`);

  return db.neighborhood.create({ data: { cityId: input.cityId, name: input.name } });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCategory(input: { name: string; parentId?: string; slug?: string }) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const existing = await db.category.findUnique({ where: { slug } });
  if (existing) throw new AppError("CONFLICT", `Category with slug "${slug}" already exists.`);

  if (input.parentId) {
    const parent = await db.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new AppError("VALIDATION_ERROR", "Unknown parent category.");
  }

  return db.category.create({ data: { name: input.name, slug, parentId: input.parentId } });
}
