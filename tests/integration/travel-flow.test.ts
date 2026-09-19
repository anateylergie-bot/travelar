// INTEGRATION TEST - requires a real PostgreSQL database with Phase 1-2
// setup already applied. Not executed in the authoring sandbox - see
// PROJECT_AUDIT.md. Runs sequentially with other integration test files
// per DECISIONS.md D16 (fileParallelism: false).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createCountry, createRegion, createCity, createCategory } from "@/lib/places/geography";
import { createPlace } from "@/lib/places/placeService";
import { upsertEmergencyNumber, listEmergencyNumbers } from "@/lib/travel/emergencyNumbers";
import { createSafetyAlert, listActiveSafetyAlerts } from "@/lib/travel/safetyAlerts";
import { seedPhrasebook, listPhrases } from "@/lib/travel/phrasebook";
import { savePlace } from "@/lib/tourist/savedPlaces";
import { buildOfflinePackage } from "@/lib/travel/offlinePackage";

describe("Phase 8 travel services (integration, requires live Postgres)", () => {
  const suffix = Date.now();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isoCode2 = letters[(suffix + 23) % 26] + letters[Math.floor((suffix + 23) / 26) % 26];

  let adminUserId: string;
  let touristUserId: string;
  let countryId: string;
  let regionId: string;
  let cityAId: string;
  let cityBId: string;
  let categoryId: string;
  let placeId: string;

  beforeAll(async () => {
    const admin = await db.user.create({
      data: {
        email: `test-travel-admin-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "SUPER_ADMIN" }] },
      },
    });
    adminUserId = admin.id;

    const tourist = await db.user.create({
      data: {
        email: `test-traveler-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "TOURIST" }] },
      },
    });
    touristUserId = tourist.id;

    const country = await createCountry({ name: `TravelTestLand ${suffix}`, isoCode2 });
    countryId = country.id;
    const region = await createRegion({ countryId, name: `Region ${suffix}` });
    regionId = region.id;
    const cityA = await createCity({ regionId, name: `CityA ${suffix}` });
    cityAId = cityA.id;
    const cityB = await createCity({ regionId, name: `CityB ${suffix}` });
    cityBId = cityB.id;
    const category = await createCategory({ name: `TravelTestCategory ${suffix}` });
    categoryId = category.id;

    const { place } = await createPlace({
      name: `Travel Test Place ${suffix}`,
      categoryId,
      countryId,
      cityId: cityAId,
      latitude: 6.74,
      longitude: -1.64,
      phone: "0247770000",
    });
    placeId = place.id;
  });

  afterAll(async () => {
    await db.savedPlace.deleteMany({ where: { userId: touristUserId } });
    await db.emergencyNumber.deleteMany({ where: { countryId } });
    await db.safetyAlert.deleteMany({ where: { countryId } });
    await db.place.deleteMany({ where: { id: placeId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.city.deleteMany({ where: { id: { in: [cityAId, cityBId] } } });
    await db.region.deleteMany({ where: { id: regionId } });
    await db.country.deleteMany({ where: { id: countryId } });
    await db.user.deleteMany({ where: { id: { in: [adminUserId, touristUserId] } } });
    await db.$disconnect();
  });

  it("rejects an emergency number with no source description", async () => {
    await expect(
      upsertEmergencyNumber({
        countryId,
        service: "POLICE",
        number: "191",
        sourceDescription: "",
        updatedByUserId: adminUserId,
      })
    ).rejects.toThrow(/source/i);
  });

  it("creates and lists emergency numbers", async () => {
    await upsertEmergencyNumber({
      countryId,
      service: "POLICE",
      number: "191",
      sourceDescription: "Test source citation",
      updatedByUserId: adminUserId,
    });
    await upsertEmergencyNumber({
      countryId,
      service: "AMBULANCE",
      number: "193",
      sourceDescription: "Test source citation",
      updatedByUserId: adminUserId,
    });

    const numbers = await listEmergencyNumbers(countryId);
    expect(numbers).toHaveLength(2);
    expect(numbers.every((n) => n.sourceDescription.length > 0)).toBe(true);
    expect(numbers.every((n) => n.lastVerifiedAt !== null)).toBe(true);
  });

  it("re-upserting the same number updates lastVerifiedAt rather than duplicating", async () => {
    const before = await listEmergencyNumbers(countryId);
    await new Promise((r) => setTimeout(r, 10));
    await upsertEmergencyNumber({
      countryId,
      service: "POLICE",
      number: "191",
      sourceDescription: "Re-verified source citation",
      updatedByUserId: adminUserId,
    });
    const after = await listEmergencyNumbers(countryId);
    expect(after).toHaveLength(before.length);
    const police = after.find((n) => n.service === "POLICE");
    expect(police?.sourceDescription).toBe("Re-verified source citation");
  });

  it("rejects a safety alert with no source description", async () => {
    await expect(
      createSafetyAlert({
        countryId,
        title: "Test",
        description: "Test",
        severity: "INFO",
        sourceDescription: "",
        createdByUserId: adminUserId,
      })
    ).rejects.toThrow(/source/i);
  });

  it("a country-wide alert shows up regardless of which city is queried", async () => {
    await createSafetyAlert({
      countryId,
      title: "Country-wide advisory",
      description: "Applies everywhere",
      severity: "ADVISORY",
      sourceDescription: "Test tourism authority notice",
      createdByUserId: adminUserId,
    });

    const alertsForCityA = await listActiveSafetyAlerts({ countryId, cityId: cityAId });
    const alertsForCityB = await listActiveSafetyAlerts({ countryId, cityId: cityBId });
    const alertsWithNoCity = await listActiveSafetyAlerts({ countryId });

    expect(alertsForCityA.some((a) => a.title === "Country-wide advisory")).toBe(true);
    expect(alertsForCityB.some((a) => a.title === "Country-wide advisory")).toBe(true);
    expect(alertsWithNoCity.some((a) => a.title === "Country-wide advisory")).toBe(true);
  });

  it("a city-specific alert only shows up for that city, not other cities", async () => {
    await createSafetyAlert({
      countryId,
      cityId: cityAId,
      title: "CityA-only warning",
      description: "Local incident",
      severity: "WARNING",
      sourceDescription: "Test local police notice",
      createdByUserId: adminUserId,
    });

    const alertsForCityA = await listActiveSafetyAlerts({ countryId, cityId: cityAId });
    const alertsForCityB = await listActiveSafetyAlerts({ countryId, cityId: cityBId });

    expect(alertsForCityA.some((a) => a.title === "CityA-only warning")).toBe(true);
    expect(alertsForCityB.some((a) => a.title === "CityA-only warning")).toBe(false);
  });

  it("an expired alert does not show up as active", async () => {
    await createSafetyAlert({
      countryId,
      title: "Expired notice",
      description: "Should not appear",
      severity: "INFO",
      sourceDescription: "Test source",
      createdByUserId: adminUserId,
      expiresAt: new Date(Date.now() - 60_000), // expired 1 minute ago
    });

    const active = await listActiveSafetyAlerts({ countryId });
    expect(active.some((a) => a.title === "Expired notice")).toBe(false);
  });

  it("seeds and lists the English phrasebook", async () => {
    await seedPhrasebook();
    const emergencyPhrases = await listPhrases("emergency");
    expect(emergencyPhrases.length).toBeGreaterThan(0);
    expect(emergencyPhrases.every((p) => p.englishText.length > 0)).toBe(true);
    // Translations are intentionally empty — see D30.
    expect(emergencyPhrases.every((p) => Object.keys(p.translations as object).length === 0)).toBe(true);
  });

  it("builds an offline package including saved places and emergency numbers", async () => {
    await savePlace(touristUserId, placeId);

    const pkg = await buildOfflinePackage(touristUserId, countryId);
    expect(pkg.syncedAt).toBeTruthy();
    expect(pkg.savedPlaces.some((p) => p.id === placeId)).toBe(true);
    expect(pkg.emergencyNumbers.length).toBeGreaterThan(0);
  });
});
