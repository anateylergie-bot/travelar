// INTEGRATION TEST - requires a real PostgreSQL database with Phase 1-2
// setup already applied. Not executed in the authoring sandbox - see
// PROJECT_AUDIT.md. Runs sequentially with other integration test files
// per DECISIONS.md D16 (fileParallelism: false).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createCountry, createRegion, createCity, createCategory } from "@/lib/places/geography";
import { createPlace } from "@/lib/places/placeService";
import { createApiKey, revokeApiKey, requireApiKeyAccess, listApiKeys } from "@/lib/b2b/apiKeys";
import { setCoverageTarget, getCityCoverageDashboard } from "@/lib/admin/coverageTargets";

describe("Phase 10 global scale (integration, requires live Postgres)", () => {
  const suffix = Date.now();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isoCode2 = letters[(suffix + 29) % 26] + letters[Math.floor((suffix + 29) / 26) % 26];

  let adminUserId: string;
  let countryId: string;
  let regionId: string;
  let cityId: string;
  let categoryId: string;

  beforeAll(async () => {
    const admin = await db.user.create({
      data: {
        email: `test-b2b-admin-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "SUPER_ADMIN" }] },
      },
    });
    adminUserId = admin.id;

    const country = await createCountry({ name: `ScaleTestLand ${suffix}`, isoCode2 });
    countryId = country.id;
    const region = await createRegion({ countryId, name: `Region ${suffix}` });
    regionId = region.id;
    const city = await createCity({ regionId, name: `City ${suffix}` });
    cityId = city.id;
    const category = await createCategory({ name: `ScaleTestCategory ${suffix}` });
    categoryId = category.id;
  });

  afterAll(async () => {
    await db.cityCoverageTarget.deleteMany({ where: { cityId } });
    await db.apiKey.deleteMany({ where: { createdByUserId: adminUserId } });
    await db.place.deleteMany({ where: { categoryId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.city.deleteMany({ where: { id: cityId } });
    await db.region.deleteMany({ where: { id: regionId } });
    await db.country.deleteMany({ where: { id: countryId } });
    await db.user.deleteMany({ where: { id: adminUserId } });
    await db.$disconnect();
  });

  let rawKey: string;
  let apiKeyId: string;

  it("creates an API key and returns the raw key exactly once", async () => {
    const { apiKey, rawKey: key } = await createApiKey({
      label: "Test integration",
      scopes: ["places.read"],
      createdByUserId: adminUserId,
    });
    apiKeyId = apiKey.id;
    rawKey = key;

    expect(rawKey).toMatch(/^tpk_/);
    expect(apiKey.keyPrefix).toBe(rawKey.slice(0, 12));
  });

  it("never exposes the key hash when listing keys", async () => {
    const keys = await listApiKeys();
    const found = keys.find((k) => k.id === apiKeyId);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("keyHash");
  });

  it("validates the raw key and checks scope", async () => {
    const validated = await requireApiKeyAccess(rawKey, "places.read");
    expect(validated.id).toBe(apiKeyId);

    await expect(requireApiKeyAccess(rawKey, "categories.read")).rejects.toThrow(/does not have/i);
  });

  it("rejects an invalid/unknown key", async () => {
    await expect(requireApiKeyAccess("tpk_not_a_real_key", "places.read")).rejects.toThrow(/invalid/i);
  });

  it("rejects a missing key", async () => {
    await expect(requireApiKeyAccess(null, "places.read")).rejects.toThrow(/missing/i);
  });

  it("increments the request count on successful validation", async () => {
    const before = await db.apiKey.findUniqueOrThrow({ where: { id: apiKeyId } });
    await requireApiKeyAccess(rawKey, "places.read");
    // Usage tracking is fire-and-forget; give it a moment to land.
    await new Promise((r) => setTimeout(r, 200));
    const after = await db.apiKey.findUniqueOrThrow({ where: { id: apiKeyId } });
    expect(after.requestCount).toBeGreaterThan(before.requestCount);
  });

  it("revoking a key blocks further use", async () => {
    await revokeApiKey(apiKeyId, adminUserId);
    await expect(requireApiKeyAccess(rawKey, "places.read")).rejects.toThrow(/revoked/i);
  });

  it("rejects revoking an already-revoked key", async () => {
    await expect(revokeApiKey(apiKeyId, adminUserId)).rejects.toThrow(/already revoked/i);
  });

  it("sets a coverage target and the dashboard reflects real place counts", async () => {
    await setCoverageTarget({ cityId, categoryId, targetCount: 5, updatedByUserId: adminUserId });

    let dashboard = await getCityCoverageDashboard(cityId);
    let row = dashboard.find((r) => r.categoryId === categoryId);
    expect(row?.target).toBe(5);
    expect(row?.current).toBe(0);
    expect(row?.gap).toBe(5);

    await createPlace({ name: `Coverage Place ${suffix}`, categoryId, countryId, cityId, latitude: 1, longitude: 1 });

    dashboard = await getCityCoverageDashboard(cityId);
    row = dashboard.find((r) => r.categoryId === categoryId);
    expect(row?.current).toBe(1);
    expect(row?.gap).toBe(4);
    expect(row?.verified).toBe(0); // DRAFT status, not yet verified
  });

  it("a city with no configured targets returns an empty dashboard, not zeros", async () => {
    const otherCity = await createCity({ regionId, name: `NoTargetCity ${suffix}` });
    const dashboard = await getCityCoverageDashboard(otherCity.id);
    expect(dashboard).toHaveLength(0);
    await db.city.deleteMany({ where: { id: otherCity.id } });
  });
});
