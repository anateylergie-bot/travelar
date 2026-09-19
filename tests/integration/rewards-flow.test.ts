// INTEGRATION TEST — requires a real PostgreSQL database with Phase 1-3
// setup already applied. Not executed in the authoring sandbox — see
// PROJECT_AUDIT.md. Runs sequentially with other integration test files
// per DECISIONS.md D16 (fileParallelism: false).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { approveAgentApplication, applyAsAgent } from "@/lib/agent/profile";
import { seedTrainingModules, completeTrainingModule } from "@/lib/agent/training";
import { createTask, acceptTask } from "@/lib/agent/tasks";
import { submitTask } from "@/lib/agent/submissions";
import { reviewSubmission } from "@/lib/agent/review";
import { createCountry, createRegion, createCity, createCategory } from "@/lib/places/geography";
import { createPlace } from "@/lib/places/placeService";
import { upsertRewardRule } from "@/lib/rewards/rewardRules";
import { confirmEarning, getWallet } from "@/lib/rewards/wallet";
import { requestPayout, processPayout } from "@/lib/rewards/payouts";
import { setPayoutConfig } from "@/lib/rewards/payoutConfig";

describe("Phase 4 rewards (integration, requires live Postgres)", () => {
  const suffix = Date.now();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isoCode2 = letters[(suffix + 7) % 26] + letters[Math.floor((suffix + 7) / 26) % 26];

  let adminUserId: string;
  let agentUserId: string;
  let countryId: string;
  let regionId: string;
  let cityId: string;
  let categoryId: string;
  let placeId: string;
  const REWARD_AMOUNT = 500; // GHS 5.00, minor units

  beforeAll(async () => {
    await seedTrainingModules();

    const admin = await db.user.create({
      data: {
        email: `test-finance-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "SUPER_ADMIN" }] },
      },
    });
    adminUserId = admin.id;

    const agent = await db.user.create({
      data: {
        email: `test-earner-${suffix}@example.dev`,
        passwordHash: await hashPassword("Str0ngPassword"),
        status: "ACTIVE",
        roles: { create: [{ role: "TOURIST" }] },
      },
    });
    agentUserId = agent.id;

    await applyAsAgent({ userId: agentUserId });
    await approveAgentApplication(agentUserId, adminUserId);

    const country = await createCountry({ name: `RewardTestLand ${suffix}`, isoCode2 });
    countryId = country.id;
    const region = await createRegion({ countryId, name: `Region ${suffix}` });
    regionId = region.id;
    const city = await createCity({ regionId: region.id, name: `City ${suffix}` });
    cityId = city.id;
    const category = await createCategory({ name: `RewardTestCategory ${suffix}` });
    categoryId = category.id;

    const { place } = await createPlace({
      name: `Reward Test Place ${suffix}`,
      categoryId,
      countryId,
      cityId: city.id,
      latitude: 6.71,
      longitude: -1.61,
    });
    placeId = place.id;

    await upsertRewardRule({
      activity: "FIELD_VERIFICATION_APPROVED",
      amountMinorUnits: REWARD_AMOUNT,
      currency: "GHS",
      updatedByUserId: adminUserId,
    });

    await setPayoutConfig(
      { minimumWithdrawalMinorUnits: 100, supportedCurrencies: ["GHS"], feeMinorUnits: 0 },
      adminUserId
    );

    const requiredModules = await db.trainingModule.findMany({
      where: { requiredForTaskTypes: { has: "FIELD_VERIFICATION" } },
    });
    // Parallelized — each completion targets a distinct (agent, module)
    // row, safe to run concurrently, and this loop was a major
    // contributor to the beforeAll hook exceeding its timeout.
    await Promise.all(requiredModules.map((m) => completeTrainingModule(agentUserId, m.id)));
  });

  afterAll(async () => {
    await db.walletTransaction.deleteMany({ where: { walletUserId: agentUserId } });
    await db.payout.deleteMany({ where: { userId: agentUserId } });
    await db.wallet.deleteMany({ where: { userId: agentUserId } });
    await db.evidence.deleteMany({ where: { submission: { agentUserId } } });
    await db.taskSubmission.deleteMany({ where: { agentUserId } });
    await db.task.deleteMany({ where: { OR: [{ createdByUserId: adminUserId }, { assignedAgentId: agentUserId }] } });
    await db.rewardRule.deleteMany({ where: { activity: "FIELD_VERIFICATION_APPROVED" } });
    await db.agentReputation.deleteMany({ where: { userId: agentUserId } });
    await db.agentTrainingCompletion.deleteMany({ where: { agentUserId } });
    await db.localDataAgentProfile.deleteMany({ where: { userId: agentUserId } });
    await db.placeChangeHistory.deleteMany({ where: { placeId } });
    await db.placeSource.deleteMany({ where: { placeId } });
    await db.place.deleteMany({ where: { id: placeId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.city.deleteMany({ where: { id: cityId } }); // must precede region deletion — City_regionId_fkey
    await db.region.deleteMany({ where: { id: regionId } });
    await db.country.deleteMany({ where: { id: countryId } });
    await db.source.deleteMany({ where: { contributorUserId: agentUserId } });
    await db.user.deleteMany({ where: { id: { in: [adminUserId, agentUserId] } } });
    await db.$disconnect();
  });

  it("starts with an empty wallet", async () => {
    const wallet = await getWallet(agentUserId);
    expect(wallet.pendingMinorUnits).toBe(0);
    expect(wallet.approvedMinorUnits).toBe(0);
  });

  let submissionId: string;

  it("approving a FIELD_VERIFICATION submission creates a pending earning matching the configured RewardRule", async () => {
    const task = await createTask({ type: "FIELD_VERIFICATION", title: "Verify", placeId, createdByUserId: adminUserId });
    await acceptTask(task.id, agentUserId);
    const submission = await submitTask({
      taskId: task.id,
      agentUserId,
      checklist: { placeExists: true },
      notes: "Confirmed.",
    });
    submissionId = submission.id;

    await reviewSubmission({ submissionId: submission.id, reviewedByUserId: adminUserId, decision: "APPROVED" });

    const wallet = await getWallet(agentUserId);
    expect(wallet.pendingMinorUnits).toBe(REWARD_AMOUNT);
    expect(wallet.approvedMinorUnits).toBe(0);

    const transactions = await db.walletTransaction.findMany({ where: { walletUserId: agentUserId } });
    expect(transactions.some((t) => t.type === "EARNING_PENDING" && t.amountMinorUnits === REWARD_AMOUNT)).toBe(true);
  });

  it("finance confirming the earning moves it from pending to approved", async () => {
    await confirmEarning({
      userId: agentUserId,
      amountMinorUnits: REWARD_AMOUNT,
      currency: "GHS",
      confirmedByUserId: adminUserId,
      submissionId,
    });

    const wallet = await getWallet(agentUserId);
    expect(wallet.pendingMinorUnits).toBe(0);
    expect(wallet.approvedMinorUnits).toBe(REWARD_AMOUNT);
  });

  it("rejects confirming more than the pending balance", async () => {
    await expect(
      confirmEarning({
        userId: agentUserId,
        amountMinorUnits: 999999,
        currency: "GHS",
        confirmedByUserId: adminUserId,
      })
    ).rejects.toThrow();
  });

  let payoutId: string;

  it("requesting a payout reserves the amount from the approved balance", async () => {
    const payout = await requestPayout({ userId: agentUserId, amountMinorUnits: REWARD_AMOUNT, currency: "GHS" });
    payoutId = payout.id;
    expect(payout.status).toBe("PENDING");

    const wallet = await getWallet(agentUserId);
    expect(wallet.approvedMinorUnits).toBe(0);
  });

  it("rejects a payout request below the configured minimum", async () => {
    await expect(requestPayout({ userId: agentUserId, amountMinorUnits: 1, currency: "GHS" })).rejects.toThrow(/minimum/i);
  });

  it("rejects a payout request in an unsupported currency", async () => {
    await expect(requestPayout({ userId: agentUserId, amountMinorUnits: 100, currency: "USD" })).rejects.toThrow(
      /not currently supported/i
    );
  });

  it("processing a payout as PAID requires a reference and increases paid balance", async () => {
    await expect(processPayout({ payoutId, processedByUserId: adminUserId, decision: "PAID" })).rejects.toThrow(
      /reference/i
    );

    const payout = await processPayout({
      payoutId,
      processedByUserId: adminUserId,
      decision: "PAID",
      reference: "MOMO-TEST-REF-123",
    });
    expect(payout.status).toBe("PAID");

    const wallet = await getWallet(agentUserId);
    expect(wallet.paidMinorUnits).toBe(REWARD_AMOUNT);
  });

  it("processing a FAILED payout reverses the reserved amount back to approved balance", async () => {
    // Directly credit a bonus so there's a fresh balance to test a FAILED payout against.
    await db.$transaction(async (tx) => {
      await tx.wallet.upsert({ where: { userId: agentUserId }, update: {}, create: { userId: agentUserId } });
      await tx.wallet.update({ where: { userId: agentUserId }, data: { approvedMinorUnits: { increment: 300 } } });
      await tx.walletTransaction.create({
        data: {
          walletUserId: agentUserId,
          type: "BONUS",
          amountMinorUnits: 300,
          currency: "GHS",
          reason: "Test setup bonus",
          createdByUserId: adminUserId,
        },
      });
    });

    const payout = await requestPayout({ userId: agentUserId, amountMinorUnits: 300, currency: "GHS" });
    const walletAfterRequest = await getWallet(agentUserId);
    expect(walletAfterRequest.approvedMinorUnits).toBe(0);

    const failed = await processPayout({
      payoutId: payout.id,
      processedByUserId: adminUserId,
      decision: "FAILED",
      failureReason: "Mobile money number invalid",
    });
    expect(failed.status).toBe("FAILED");

    const walletAfterFailure = await getWallet(agentUserId);
    expect(walletAfterFailure.approvedMinorUnits).toBe(300);
  });

  it("blocks payout requests when the agent's fraud status is SUSPENDED", async () => {
    await db.agentReputation.update({ where: { userId: agentUserId }, data: { fraudStatus: "SUSPENDED" } });

    await expect(requestPayout({ userId: agentUserId, amountMinorUnits: 100, currency: "GHS" })).rejects.toThrow(
      /under review/i
    );

    // Reset for cleanliness, though afterAll deletes the row anyway.
    await db.agentReputation.update({ where: { userId: agentUserId }, data: { fraudStatus: "NORMAL" } });
  });
});
