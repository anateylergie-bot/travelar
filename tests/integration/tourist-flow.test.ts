// INTEGRATION TEST - requires a real PostgreSQL database with Phase 1-3
// setup already applied. Not executed in the authoring sandbox - see
// PROJECT_AUDIT.md. Runs sequentially with other integration test files
// per DECISIONS.md D16 (fileParallelism: false).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createCountry, createRegion, createCity, createCategory } from "@/lib/places/geography";
import { createPlace } from "@/lib/places/placeService";
import { savePlace, unsavePlace, listSavedPlaces } from "@/lib/tourist/savedPlaces";
import { submitReport, reviewReport, resolveReport } from "@/lib/tourist/reports";
import { searchPlaces } from "@/lib/tourist/search";

describe("Phase 6 tourist platform (integration, requires live Postgres)", () => {
  const suffix = Date.now();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isoCode2 = letters[(suffix + 19) % 26] + letters[Math.floor((suffix + 19) / 26) % 26];

  let touristUserId: string;
  let moderatorUserId: string;
  let countryId: string;
  let regionId: string;
  let cityId: string;
  let categoryId: string;
  let placeId: string;

  beforeAll(async () => {
    const tourist = await db.user.create({
      data: {
        email: `test-visitor-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "TOURIST" }] },
      },
    });
    touristUserId = tourist.id;

    const moderator = await db.user.create({
      data: {
        email: `test-mod-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "MODERATOR" }] },
      },
    });
    moderatorUserId = moderator.id;

    const country = await createCountry({ name: `TouristTestLand ${suffix}`, isoCode2 });
    countryId = country.id;
    const region = await createRegion({ countryId, name: `Region ${suffix}` });
    regionId = region.id;
    const city = await createCity({ regionId, name: `City ${suffix}` });
    cityId = city.id;
    const category = await createCategory({ name: `TouristTestCategory ${suffix}` });
    categoryId = category.id;

    const { place } = await createPlace({
      name: `Tourist Test Place ${suffix}`,
      categoryId,
      countryId,
      cityId,
      latitude: 6.73,
      longitude: -1.63,
      phone: "0245550000",
    });
    placeId = place.id;
  });

  afterAll(async () => {
    await db.report.deleteMany({ where: { placeId } });
    await db.savedPlace.deleteMany({ where: { placeId } });
    await db.task.deleteMany({ where: { placeId } });
    await db.placeChangeHistory.deleteMany({ where: { placeId } });
    await db.place.deleteMany({ where: { id: placeId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.city.deleteMany({ where: { id: cityId } });
    await db.region.deleteMany({ where: { id: regionId } });
    await db.country.deleteMany({ where: { id: countryId } });
    await db.user.deleteMany({ where: { id: { in: [touristUserId, moderatorUserId] } } });
    await db.$disconnect();
  });

  it("finds the place via non-geospatial search by city and name", async () => {
    const results = await searchPlaces({ cityId, nameQuery: "Tourist Test Place" });
    expect(results.some((r) => r.id === placeId)).toBe(true);
  });

  it("saves a place, lists it, and unsaving removes it", async () => {
    await savePlace(touristUserId, placeId);
    let saved = await listSavedPlaces(touristUserId);
    expect(saved.some((s) => s.placeId === placeId)).toBe(true);

    // Saving again is idempotent (upsert), not an error.
    await savePlace(touristUserId, placeId);
    saved = await listSavedPlaces(touristUserId);
    expect(saved.filter((s) => s.placeId === placeId)).toHaveLength(1);

    await unsavePlace(touristUserId, placeId);
    saved = await listSavedPlaces(touristUserId);
    expect(saved.some((s) => s.placeId === placeId)).toBe(false);
  });

  let reportId: string;

  it("submits a report with a valid reason", async () => {
    const report = await submitReport({
      placeId,
      reporterUserId: touristUserId,
      reason: "WRONG_PHONE",
      details: "I called and the number is disconnected.",
    });
    reportId = report.id;
    expect(report.status).toBe("PENDING");
  });

  it("reviewing with CREATE_VERIFICATION_TASK creates a real Task linked back to the report", async () => {
    const report = await reviewReport({
      reportId,
      reviewedByUserId: moderatorUserId,
      decision: "CREATE_VERIFICATION_TASK",
    });

    expect(report.status).toBe("TASK_CREATED");
    expect(report.linkedTaskId).not.toBeNull();

    const task = await db.task.findUniqueOrThrow({ where: { id: report.linkedTaskId! } });
    expect(task.type).toBe("CONTACT_VERIFICATION"); // WRONG_PHONE maps to CONTACT_VERIFICATION
    expect(task.placeId).toBe(placeId);
  });

  it("rejects reviewing an already-reviewed report", async () => {
    await expect(
      reviewReport({ reportId, reviewedByUserId: moderatorUserId, decision: "DISMISS" })
    ).rejects.toThrow(/already reviewed/i);
  });

  it("resolves a report manually", async () => {
    const resolved = await resolveReport({ reportId, reviewedByUserId: moderatorUserId, resolutionNotes: "Confirmed fixed." });
    expect(resolved.status).toBe("RESOLVED");
  });

  it("cannot auto-create a task for a reason with no task mapping (e.g. OFFENSIVE_CONTENT)", async () => {
    const report2 = await submitReport({ placeId, reporterUserId: touristUserId, reason: "OFFENSIVE_CONTENT" });
    await expect(
      reviewReport({ reportId: report2.id, reviewedByUserId: moderatorUserId, decision: "CREATE_VERIFICATION_TASK" })
    ).rejects.toThrow(/cannot auto-create/i);

    // Dismissing is still fine for this reason.
    const dismissed = await reviewReport({ reportId: report2.id, reviewedByUserId: moderatorUserId, decision: "DISMISS" });
    expect(dismissed.status).toBe("DISMISSED");
  });
});
