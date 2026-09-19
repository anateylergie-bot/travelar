// INTEGRATION TEST — requires a real PostgreSQL database with Phase 2's
// PostGIS setup already applied (place creation is exercised here too).
// Not executed in the authoring sandbox — see PROJECT_AUDIT.md.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { applyAsAgent, approveAgentApplication } from "@/lib/agent/profile";
import { seedTrainingModules, completeTrainingModule } from "@/lib/agent/training";
import { createTask, acceptTask, rejectTask } from "@/lib/agent/tasks";
import { submitTask } from "@/lib/agent/submissions";
import { reviewSubmission } from "@/lib/agent/review";
import { createCountry, createRegion, createCity, createCategory } from "@/lib/places/geography";
import { createPlace } from "@/lib/places/placeService";

describe("Phase 3 agent platform (integration, requires live Postgres)", () => {
  const suffix = Date.now();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isoCode2 = letters[(suffix + 1) % 26] + letters[Math.floor((suffix + 1) / 26) % 26];

  let adminUserId: string;
  let agentUserId: string;
  let countryId: string;
  let cityId: string;
  let categoryId: string;
  let placeId: string;

  beforeAll(async () => {
    await seedTrainingModules();

    const admin = await db.user.create({
      data: {
        email: `test-reviewer-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "SUPER_ADMIN" }] },
      },
    });
    adminUserId = admin.id;

    const agent = await db.user.create({
      data: {
        email: `test-applicant-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "TOURIST" }] },
      },
    });
    agentUserId = agent.id;

    const country = await createCountry({ name: `AgentTestLand ${suffix}`, isoCode2 });
    countryId = country.id;
    const region = await createRegion({ countryId, name: `Region ${suffix}` });
    const city = await createCity({ regionId: region.id, name: `City ${suffix}` });
    cityId = city.id;
    const category = await createCategory({ name: `AgentTestCategory ${suffix}` });
    categoryId = category.id;

    const { place } = await createPlace({
      name: `Place To Verify ${suffix}`,
      categoryId,
      countryId,
      cityId,
      latitude: 6.7,
      longitude: -1.6,
    });
    placeId = place.id;
  });

  afterAll(async () => {
    await db.evidence.deleteMany({ where: { submission: { agentUserId } } });
    await db.taskSubmission.deleteMany({ where: { agentUserId } });
    await db.task.deleteMany({ where: { OR: [{ createdByUserId: adminUserId }, { assignedAgentId: agentUserId }] } });
    await db.agentReputation.deleteMany({ where: { userId: agentUserId } });
    await db.agentTrainingCompletion.deleteMany({ where: { agentUserId } });
    await db.localDataAgentProfile.deleteMany({ where: { userId: agentUserId } });
    await db.placeChangeHistory.deleteMany({ where: { placeId } });
    await db.placeSource.deleteMany({ where: { placeId } });
    await db.place.deleteMany({ where: { id: placeId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.city.deleteMany({ where: { id: cityId } });
    await db.region.deleteMany({ where: { countryId } });
    await db.country.deleteMany({ where: { id: countryId } });
    await db.source.deleteMany({ where: { contributorUserId: agentUserId } });
    await db.user.deleteMany({ where: { id: { in: [adminUserId, agentUserId] } } });
    await db.$disconnect();
  });

  it("does not grant LOCAL_DATA_AGENT role merely by applying (D15)", async () => {
    await applyAsAgent({ userId: agentUserId, city: "Kumasi" });

    const roles = await db.userRole.findMany({ where: { userId: agentUserId } });
    expect(roles.map((r) => r.role)).not.toContain("LOCAL_DATA_AGENT");
  });

  it("rejects a second application from the same user", async () => {
    await expect(applyAsAgent({ userId: agentUserId, city: "Kumasi" })).rejects.toThrow();
  });

  it("grants LOCAL_DATA_AGENT role and creates a reputation row on approval", async () => {
    await approveAgentApplication(agentUserId, adminUserId);

    const roles = await db.userRole.findMany({ where: { userId: agentUserId } });
    expect(roles.map((r) => r.role)).toContain("LOCAL_DATA_AGENT");

    const reputation = await db.agentReputation.findUnique({ where: { userId: agentUserId } });
    expect(reputation).not.toBeNull();
    expect(reputation!.level).toBe("LEVEL_1_NEW");
  });

  let fieldVerificationTaskId: string;

  it("creates a FIELD_VERIFICATION task tied to the existing place", async () => {
    const task = await createTask({
      type: "FIELD_VERIFICATION",
      title: "Confirm this place exists",
      placeId,
      createdByUserId: adminUserId,
    });
    fieldVerificationTaskId = task.id;
    expect(task.status).toBe("OPEN");
  });

  it("lets the agent accept the task", async () => {
    const task = await acceptTask(fieldVerificationTaskId, agentUserId);
    expect(task.status).toBe("ASSIGNED");
    expect(task.assignedAgentId).toBe(agentUserId);
  });

  it("blocks submission until required training is complete", async () => {
    await expect(
      submitTask({
        taskId: fieldVerificationTaskId,
        agentUserId,
        checklist: { placeExists: true },
      })
    ).rejects.toThrow(/training/i);
  });

  it("allows submission after completing required training modules", async () => {
    const requiredModules = await db.trainingModule.findMany({
      where: { requiredForTaskTypes: { has: "FIELD_VERIFICATION" } },
    });
    expect(requiredModules.length).toBeGreaterThan(0);

    // Parallelized — see D16/rewards-flow.test.ts for why this matters
    // for beforeAll/test wall-clock time against a remote pooled DB.
    await Promise.all(requiredModules.map((m) => completeTrainingModule(agentUserId, m.id)));

    const submission = await submitTask({
      taskId: fieldVerificationTaskId,
      agentUserId,
      checklist: {
        placeExists: true,
        nameMatches: true,
        locationMatches: true,
        appearsOperational: true,
        contactVerified: false,
        openingInfoChecked: true,
      },
      notes: "Confirmed in person, signage matches.",
      gpsLat: 6.7001,
      gpsLng: -1.5999,
      gpsAccuracyMeters: 12,
    });

    expect(submission.reviewStatus).toBe("PENDING");

    const task = await db.task.findUniqueOrThrow({ where: { id: fieldVerificationTaskId } });
    expect(task.status).toBe("SUBMITTED");
  });

  it("approving the submission marks the place FIELD_VERIFIED and updates reputation", async () => {
    const submission = await db.taskSubmission.findFirstOrThrow({ where: { taskId: fieldVerificationTaskId } });

    await reviewSubmission({
      submissionId: submission.id,
      reviewedByUserId: adminUserId,
      decision: "APPROVED",
      reviewNotes: "Looks good.",
    });

    const place = await db.place.findUniqueOrThrow({ where: { id: placeId } });
    expect(place.verificationStatus).toBe("FIELD_VERIFIED");
    expect(place.lastVerifiedAt).not.toBeNull();

    const reputation = await db.agentReputation.findUniqueOrThrow({ where: { userId: agentUserId } });
    expect(reputation.approvedSubmissionsCount).toBe(1);
    expect(reputation.level).toBe("LEVEL_2_CONTRIBUTOR");

    const history = await db.placeChangeHistory.findMany({ where: { placeId } });
    expect(history.some((h) => h.reason?.includes("FIELD_VERIFICATION"))).toBe(true);
  });

  it("lets an agent reject a separately assigned task without a reputation penalty (D14)", async () => {
    const task = await createTask({
      type: "CONTACT_VERIFICATION",
      title: "Verify phone number",
      placeId,
      createdByUserId: adminUserId,
    });
    await acceptTask(task.id, agentUserId);

    const reputationBefore = await db.agentReputation.findUniqueOrThrow({ where: { userId: agentUserId } });

    const rejected = await rejectTask(task.id, agentUserId, "This area is unsafe to visit right now.");
    expect(rejected.status).toBe("REJECTED_BY_AGENT");
    expect(rejected.assignedAgentId).toBeNull();

    const reputationAfter = await db.agentReputation.findUniqueOrThrow({ where: { userId: agentUserId } });
    expect(reputationAfter.accuracyScore).toBe(reputationBefore.accuracyScore);
    expect(reputationAfter.completedTasksCount).toBe(reputationBefore.completedTasksCount);
  });
});
