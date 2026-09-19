// INTEGRATION TEST — requires a real PostgreSQL database with PostGIS
// enabled (see prisma/manual-sql/001-postgis-and-constraints.sql — run
// that BEFORE this test file, or the geospatial queries will fail with
// "function st_dwithin does not exist").
//
// Not executed in the authoring sandbox — same constraint as Phase 1's
// integration tests (see PROJECT_AUDIT.md). Run with:
//   npx prisma migrate dev --name phase2_local_data_engine
//   (then run the manual SQL file against your DB)
//   npm test

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createCountry, createRegion, createCity, createCategory } from "@/lib/places/geography";
import { createPlace } from "@/lib/places/placeService";
import { findNearbyPlaces } from "@/lib/places/geo";
import { findPotentialDuplicates } from "@/lib/places/duplicateService";

describe("Phase 2 local data engine (integration, requires live Postgres + PostGIS)", () => {
  const suffix = Date.now();
  // Generate a pseudo-random 2-letter code so repeated test runs don't
  // collide on the unique isoCode2 constraint (createCountry requires
  // exactly 2 letters — digits would fail validation).
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isoCode2 = letters[suffix % 26] + letters[Math.floor(suffix / 26) % 26];
  let countryId: string;
  let regionId: string;
  let cityId: string;
  let categoryId: string;

  beforeAll(async () => {
    const country = await createCountry({ name: `TestLand ${suffix}`, isoCode2 });
    countryId = country.id;

    const region = await createRegion({ countryId, name: `Test Region ${suffix}` });
    regionId = region.id;

    const city = await createCity({ regionId, name: `Test City ${suffix}`, centroidLat: 6.6885, centroidLng: -1.6244 });
    cityId = city.id;

    const category = await createCategory({ name: `Test Category ${suffix}` });
    categoryId = category.id;
  });

  afterAll(async () => {
    // Clean up in dependency order (children first).
    await db.placeChangeHistory.deleteMany({ where: { place: { categoryId } } });
    await db.place.deleteMany({ where: { categoryId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.city.deleteMany({ where: { id: cityId } });
    await db.region.deleteMany({ where: { id: regionId } });
    await db.country.deleteMany({ where: { id: countryId } });
    await db.$disconnect();
  });

  it("builds the Country -> Region -> City -> Category hierarchy", async () => {
    const country = await db.country.findUniqueOrThrow({ where: { id: countryId } });
    const region = await db.region.findUniqueOrThrow({ where: { id: regionId } });
    const city = await db.city.findUniqueOrThrow({ where: { id: cityId } });

    expect(region.countryId).toBe(country.id);
    expect(city.regionId).toBe(region.id);
  });

  it("rejects a duplicate country ISO code", async () => {
    const country = await db.country.findUniqueOrThrow({ where: { id: countryId } });
    await expect(createCountry({ name: "Whatever", isoCode2: country.isoCode2 })).rejects.toThrow();
  });

  it("creates a place with DRAFT status and no duplicates when none exist nearby", async () => {
    const result = await createPlace({
      name: `Unique Test Place ${suffix}`,
      categoryId,
      countryId,
      regionId,
      cityId,
      latitude: 6.6885,
      longitude: -1.6244,
      phone: "0241234567",
    });

    expect(result.place.verificationStatus).toBe("DRAFT");
    expect(result.potentialDuplicates).toHaveLength(0);
  });

  it("finds the place via geospatial nearby search", async () => {
    const results = await findNearbyPlaces({
      latitude: 6.6885,
      longitude: -1.6244,
      radiusMeters: 500,
      categoryId,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.distanceMeters).toBeLessThan(50);
  });

  it("does NOT find the place when searching far away", async () => {
    const results = await findNearbyPlaces({
      latitude: 5.55, // Accra — ~200km from Kumasi-area test coordinates
      longitude: -0.2,
      radiusMeters: 1000,
      categoryId,
    });
    expect(results).toHaveLength(0);
  });

  it("flags a near-duplicate submission with matching phone and similar name/location", async () => {
    const signals = await findPotentialDuplicates({
      name: `Unique Test Plce ${suffix}`, // deliberate typo
      latitude: 6.6886, // ~15m away
      longitude: -1.6245,
      phone: "0241234567",
      categoryId,
    });

    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0]?.score).toBeGreaterThan(70);
  });

  it("creates a PlaceChangeHistory entry on place creation", async () => {
    const result = await createPlace({
      name: `History Test Place ${suffix}`,
      categoryId,
      countryId,
      latitude: 1.0,
      longitude: 1.0,
    });

    const history = await db.placeChangeHistory.findMany({ where: { placeId: result.place.id } });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.fieldChanged).toBe("*");
  });
});
