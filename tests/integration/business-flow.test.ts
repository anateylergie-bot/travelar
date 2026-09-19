// INTEGRATION TEST - requires a real PostgreSQL database with Phase 1-2
// setup already applied. Not executed in the authoring sandbox - see
// PROJECT_AUDIT.md. Runs sequentially with other integration test files
// per DECISIONS.md D16 (fileParallelism: false).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createCountry, createRegion, createCity, createCategory } from "@/lib/places/geography";
import { createPlace } from "@/lib/places/placeService";
import { submitClaim, reviewClaim } from "@/lib/business/claims";
import { submitUpdateRequest, reviewUpdateRequest } from "@/lib/business/updates";

describe("Phase 5 business system (integration, requires live Postgres)", () => {
  const suffix = Date.now();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isoCode2 = letters[(suffix + 13) % 26] + letters[Math.floor((suffix + 13) / 26) % 26];

  let adminUserId: string;
  let ownerUserId: string;
  let otherUserId: string;
  let countryId: string;
  let regionId: string;
  let cityId: string;
  let categoryId: string;
  let placeId: string;

  beforeAll(async () => {
    const admin = await db.user.create({
      data: {
        email: `test-moderator-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "SUPER_ADMIN" }] },
      },
    });
    adminUserId = admin.id;

    const owner = await db.user.create({
      data: {
        email: `test-owner-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "TOURIST" }] },
      },
    });
    ownerUserId = owner.id;

    const other = await db.user.create({
      data: {
        email: `test-other-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "TOURIST" }] },
      },
    });
    otherUserId = other.id;

    const country = await createCountry({ name: `BizTestLand ${suffix}`, isoCode2 });
    countryId = country.id;
    const region = await createRegion({ countryId, name: `Region ${suffix}` });
    regionId = region.id;
    const city = await createCity({ regionId, name: `City ${suffix}` });
    cityId = city.id;
    const category = await createCategory({ name: `BizTestCategory ${suffix}` });
    categoryId = category.id;

    const { place } = await createPlace({
      name: `Business Test Place ${suffix}`,
      categoryId,
      countryId,
      cityId,
      latitude: 6.72,
      longitude: -1.62,
      phone: "0240000000",
    });
    placeId = place.id;
  });

  afterAll(async () => {
    await db.placeChangeHistory.deleteMany({ where: { placeId } });
    await db.placeSource.deleteMany({ where: { placeId } });
    await db.businessUpdateRequest.deleteMany({ where: { placeId } });
    await db.businessClaim.deleteMany({ where: { placeId } });
    await db.place.deleteMany({ where: { id: placeId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.city.deleteMany({ where: { id: cityId } });
    await db.region.deleteMany({ where: { id: regionId } });
    await db.country.deleteMany({ where: { id: countryId } });
    await db.source.deleteMany({ where: { contributorUserId: ownerUserId } });
    await db.userRole.deleteMany({ where: { userId: { in: [ownerUserId, otherUserId] } } });
    await db.user.deleteMany({ where: { id: { in: [adminUserId, ownerUserId, otherUserId] } } });
    await db.$disconnect();
  });

  let claimId: string;

  it("submits a claim without granting BUSINESS_OWNER yet", async () => {
    const claim = await submitClaim({
      placeId,
      claimantUserId: ownerUserId,
      justification: "I manage this place",
      evidenceDescription: "My phone number matches the listed number",
    });
    claimId = claim.id;
    expect(claim.status).toBe("PENDING");

    const roles = await db.userRole.findMany({ where: { userId: ownerUserId } });
    expect(roles.map((r) => r.role)).not.toContain("BUSINESS_OWNER");
  });

  it("rejects a duplicate pending claim from the same user", async () => {
    await expect(submitClaim({ placeId, claimantUserId: ownerUserId })).rejects.toThrow(/pending claim/i);
  });

  it("approving the claim grants BUSINESS_OWNER, sets ownerUserId, and marks OWNER_VERIFIED", async () => {
    await reviewClaim({ claimId, reviewedByUserId: adminUserId, decision: "APPROVED" });

    const roles = await db.userRole.findMany({ where: { userId: ownerUserId } });
    expect(roles.map((r) => r.role)).toContain("BUSINESS_OWNER");

    const place = await db.place.findUniqueOrThrow({ where: { id: placeId } });
    expect(place.ownerUserId).toBe(ownerUserId);
    expect(place.verificationStatus).toBe("OWNER_VERIFIED");
  });

  it("rejects a new claim on an already-owned place", async () => {
    await expect(submitClaim({ placeId, claimantUserId: otherUserId })).rejects.toThrow(/verified owner/i);
  });

  let updateRequestId: string;

  it("rejects an update request from a non-owner", async () => {
    await expect(
      submitUpdateRequest({ placeId, requestedByUserId: otherUserId, changes: { phone: "0209999999" } })
    ).rejects.toThrow(/do not own/i);
  });

  it("lets the verified owner submit an update request that stays PENDING (not applied instantly)", async () => {
    const request = await submitUpdateRequest({
      placeId,
      requestedByUserId: ownerUserId,
      changes: { phone: "0209999999", description: "Newly renovated!" },
    });
    updateRequestId = request.id;
    expect(request.status).toBe("PENDING");

    const place = await db.place.findUniqueOrThrow({ where: { id: placeId } });
    expect(place.phone).toBe("0240000000"); // unchanged - D23, moderation required
  });

  it("rejects a change to a field outside the editable allowlist", async () => {
    await expect(
      submitUpdateRequest({ placeId, requestedByUserId: ownerUserId, changes: { verificationStatus: "FIELD_VERIFIED" } as any })
    ).rejects.toThrow();
  });

  it("approving the update request applies the diff and logs change history", async () => {
    await reviewUpdateRequest({ requestId: updateRequestId, reviewedByUserId: adminUserId, decision: "APPROVED" });

    const place = await db.place.findUniqueOrThrow({ where: { id: placeId } });
    expect(place.phone).toBe("0209999999");
    expect(place.description).toBe("Newly renovated!");

    const history = await db.placeChangeHistory.findMany({ where: { placeId, fieldChanged: "phone" } });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.previousValue).toEqual("0240000000");
    expect(history[0]?.newValue).toEqual("0209999999");
  });

  it("rejecting an update request leaves the place unchanged", async () => {
    const request = await submitUpdateRequest({
      placeId,
      requestedByUserId: ownerUserId,
      changes: { phone: "0201111111" },
    });

    await reviewUpdateRequest({
      requestId: request.id,
      reviewedByUserId: adminUserId,
      decision: "REJECTED",
      reviewNotes: "Could not verify this number.",
    });

    const place = await db.place.findUniqueOrThrow({ where: { id: placeId } });
    expect(place.phone).toBe("0209999999"); // still the previously-approved value
  });
});
