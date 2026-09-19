import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import type { WalletTransactionType, Prisma } from "@prisma/client";

// See DECISIONS.md D18: Wallet's cached totals are ALWAYS updated in the
// same DB transaction as the WalletTransaction ledger row that justifies
// the change. There is no other code path permitted to touch Wallet
// balances — every function in this file is the only way money moves.

async function getOrCreateWallet(userId: string, tx: Prisma.TransactionClient = db) {
  return tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export interface LedgerEntryInput {
  userId: string;
  type: WalletTransactionType;
  amountMinorUnits: number;
  currency: string;
  relatedTaskId?: string;
  relatedSubmissionId?: string;
  relatedPayoutId?: string;
  reason?: string;
  createdByUserId?: string;
}

function ledgerTypeToBalanceUpdate(type: WalletTransactionType, amount: number) {
  switch (type) {
    case "EARNING_PENDING":
      return { pendingMinorUnits: { increment: amount } };
    case "EARNING_APPROVED":
      // Moves from pending to approved — caller must have already
      // verified sufficient pending balance (see confirmEarning()).
      return { pendingMinorUnits: { decrement: amount }, approvedMinorUnits: { increment: amount } };
    case "EARNING_REVERSED":
      return { approvedMinorUnits: { decrement: amount }, reversedMinorUnits: { increment: amount } };
    case "PAYOUT_REQUESTED":
      return { approvedMinorUnits: { decrement: amount } };
    case "PAYOUT_PAID":
      return { paidMinorUnits: { increment: amount } };
    case "PAYOUT_REVERSED":
      return { approvedMinorUnits: { increment: amount } };
    case "BONUS":
      return { approvedMinorUnits: { increment: amount } };
    case "ADJUSTMENT":
      // Positive-only ledger convention (see below) means a downward
      // adjustment must be recorded as EARNING_REVERSED instead;
      // ADJUSTMENT here always increases approved balance (e.g.
      // correcting an under-payment).
      return { approvedMinorUnits: { increment: amount } };
  }
}

/**
 * The ONLY function that writes a WalletTransaction and updates Wallet
 * totals. Every "move money" operation in this module calls this, always
 * inside a transaction supplied by the caller.
 */
async function writeLedgerEntry(input: LedgerEntryInput, tx: Prisma.TransactionClient) {
  if (input.amountMinorUnits <= 0) {
    throw new AppError("VALIDATION_ERROR", "Ledger entries must have a positive amount.");
  }

  await getOrCreateWallet(input.userId, tx);

  const balanceUpdate = ledgerTypeToBalanceUpdate(input.type, input.amountMinorUnits);
  await tx.wallet.update({ where: { userId: input.userId }, data: balanceUpdate });

  return tx.walletTransaction.create({
    data: {
      walletUserId: input.userId,
      type: input.type,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      relatedTaskId: input.relatedTaskId,
      relatedSubmissionId: input.relatedSubmissionId,
      relatedPayoutId: input.relatedPayoutId,
      reason: input.reason,
      createdByUserId: input.createdByUserId,
    },
  });
}

export async function recordPendingEarning(params: {
  userId: string;
  amountMinorUnits: number;
  currency: string;
  taskId: string;
  submissionId: string;
}) {
  return db.$transaction((tx) =>
    writeLedgerEntry(
      {
        userId: params.userId,
        type: "EARNING_PENDING",
        amountMinorUnits: params.amountMinorUnits,
        currency: params.currency,
        relatedTaskId: params.taskId,
        relatedSubmissionId: params.submissionId,
        reason: "Submission approved",
      },
      tx
    )
  );
}

export async function confirmEarning(params: {
  userId: string;
  amountMinorUnits: number;
  currency: string;
  confirmedByUserId: string;
  submissionId?: string;
}) {
  return db.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(params.userId, tx);
    if (wallet.pendingMinorUnits < params.amountMinorUnits) {
      throw new AppError("CONFLICT", "Insufficient pending balance to confirm this amount.");
    }
    return writeLedgerEntry(
      {
        userId: params.userId,
        type: "EARNING_APPROVED",
        amountMinorUnits: params.amountMinorUnits,
        currency: params.currency,
        relatedSubmissionId: params.submissionId,
        reason: "Finance confirmation",
        createdByUserId: params.confirmedByUserId,
      },
      tx
    );
  });
}

export async function reverseEarning(params: {
  userId: string;
  amountMinorUnits: number;
  currency: string;
  reversedByUserId: string;
  reason: string;
}) {
  return db.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(params.userId, tx);
    if (wallet.approvedMinorUnits < params.amountMinorUnits) {
      throw new AppError("CONFLICT", "Insufficient approved balance to reverse this amount.");
    }
    return writeLedgerEntry(
      {
        userId: params.userId,
        type: "EARNING_REVERSED",
        amountMinorUnits: params.amountMinorUnits,
        currency: params.currency,
        reason: params.reason,
        createdByUserId: params.reversedByUserId,
      },
      tx
    );
  });
}

export async function recordBonus(params: {
  userId: string;
  amountMinorUnits: number;
  currency: string;
  grantedByUserId: string;
  reason: string;
}) {
  if (!params.reason || params.reason.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "A reason is required for any manual bonus.");
  }
  return db.$transaction((tx) =>
    writeLedgerEntry(
      {
        userId: params.userId,
        type: "BONUS",
        amountMinorUnits: params.amountMinorUnits,
        currency: params.currency,
        reason: params.reason,
        createdByUserId: params.grantedByUserId,
      },
      tx
    )
  );
}

export async function getWallet(userId: string) {
  return db.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function getWalletTransactions(userId: string, limit = 50) {
  return db.walletTransaction.findMany({
    where: { walletUserId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function formatMinorUnits(amountMinorUnits: number, currency: string): string {
  const major = amountMinorUnits / 100;
  return `${currency} ${major.toFixed(2)}`;
}

// Exported for the payout module, which needs its own ledger writes
// (PAYOUT_REQUESTED / PAYOUT_PAID / PAYOUT_REVERSED) inside its own
// transactions alongside Payout row changes.
export { writeLedgerEntry, getOrCreateWallet };
