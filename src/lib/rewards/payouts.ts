import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import { getWallet, writeLedgerEntry } from "./wallet";
import { getFraudStatus } from "./fraudStatus";
import { getPayoutConfig } from "./payoutConfig";
import { payoutProvider } from "@/lib/payments/manualPayoutProvider";

export async function requestPayout(params: { userId: string; amountMinorUnits: number; currency: string }) {
  const fraudStatus = await getFraudStatus(params.userId);
  if (fraudStatus === "SUSPENDED") {
    throw new AppError("UNAUTHORIZED", "Your account is under review. Payout requests are paused until this is resolved.");
  }

  const config = await getPayoutConfig();
  if (!config.supportedCurrencies.includes(params.currency)) {
    throw new AppError("VALIDATION_ERROR", `Currency ${params.currency} is not currently supported for payout.`);
  }
  if (params.amountMinorUnits < config.minimumWithdrawalMinorUnits) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Minimum withdrawal is ${config.minimumWithdrawalMinorUnits} minor units of ${params.currency}.`
    );
  }

  const wallet = await getWallet(params.userId);
  if (wallet.approvedMinorUnits < params.amountMinorUnits) {
    throw new AppError("CONFLICT", "Insufficient approved balance for this payout amount.");
  }

  return db.$transaction(async (tx) => {
    const payout = await tx.payout.create({
      data: {
        userId: params.userId,
        amountMinorUnits: params.amountMinorUnits,
        currency: params.currency,
        status: "PENDING",
        provider: "MANUAL",
      },
    });

    await writeLedgerEntry(
      {
        userId: params.userId,
        type: "PAYOUT_REQUESTED",
        amountMinorUnits: params.amountMinorUnits,
        currency: params.currency,
        relatedPayoutId: payout.id,
        reason: "Payout requested",
      },
      tx
    );

    return payout;
  });
}

export interface ProcessPayoutInput {
  payoutId: string;
  processedByUserId: string;
  decision: "PAID" | "FAILED";
  reference?: string;
  failureReason?: string;
}

export async function processPayout(input: ProcessPayoutInput) {
  const payout = await db.payout.findUnique({ where: { id: input.payoutId } });
  if (!payout) throw new AppError("NOT_FOUND", "Payout not found.");
  if (payout.status !== "PENDING" && payout.status !== "PROCESSING") {
    throw new AppError("CONFLICT", `This payout was already resolved (status: ${payout.status}).`);
  }

  if (input.decision === "PAID") {
    if (!input.reference) {
      throw new AppError("VALIDATION_ERROR", "A reference is required to mark a payout as paid.");
    }

    // The manual provider never actually succeeds automatically (see
    // DECISIONS.md D21) — a Finance Administrator is asserting they moved
    // the money themselves and providing the reference as evidence.
    await payoutProvider.processPayout({
      payoutId: payout.id,
      userId: payout.userId,
      amountMinorUnits: payout.amountMinorUnits,
      currency: payout.currency,
    });

    return db.$transaction(async (tx) => {
      const updated = await tx.payout.update({
        where: { id: payout.id },
        data: { status: "PAID", reference: input.reference, processedAt: new Date(), processedByUserId: input.processedByUserId },
      });

      await writeLedgerEntry(
        {
          userId: payout.userId,
          type: "PAYOUT_PAID",
          amountMinorUnits: payout.amountMinorUnits,
          currency: payout.currency,
          relatedPayoutId: payout.id,
          reason: `Paid via reference ${input.reference}`,
          createdByUserId: input.processedByUserId,
        },
        tx
      );

      return updated;
    });
  }

  // FAILED — return the reserved amount to the approved balance.
  return db.$transaction(async (tx) => {
    const updated = await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: "FAILED",
        failureReason: input.failureReason ?? "Not specified",
        processedAt: new Date(),
        processedByUserId: input.processedByUserId,
      },
    });

    await writeLedgerEntry(
      {
        userId: payout.userId,
        type: "PAYOUT_REVERSED",
        amountMinorUnits: payout.amountMinorUnits,
        currency: payout.currency,
        relatedPayoutId: payout.id,
        reason: input.failureReason ?? "Payout failed",
        createdByUserId: input.processedByUserId,
      },
      tx
    );

    return updated;
  });
}
