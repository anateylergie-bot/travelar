-- CreateEnum
CREATE TYPE "AgentFraudStatus" AS ENUM ('NORMAL', 'REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RewardActivityType" AS ENUM ('NEW_PLACE_APPROVED', 'FIELD_VERIFICATION_APPROVED', 'UPDATE_APPROVED', 'CLOSURE_CONFIRMED', 'CONTACT_VERIFICATION_APPROVED', 'LOCATION_VERIFICATION_APPROVED', 'PHOTO_TASK_APPROVED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('EARNING_PENDING', 'EARNING_APPROVED', 'EARNING_REVERSED', 'PAYOUT_REQUESTED', 'PAYOUT_PAID', 'PAYOUT_REVERSED', 'BONUS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutProviderType" AS ENUM ('MOBILE_MONEY', 'BANK_TRANSFER', 'MANUAL');

-- AlterTable
ALTER TABLE "AgentReputation" ADD COLUMN     "fraudStatus" "AgentFraudStatus" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "activity" "RewardActivityType" NOT NULL,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "pendingMinorUnits" INTEGER NOT NULL DEFAULT 0,
    "approvedMinorUnits" INTEGER NOT NULL DEFAULT 0,
    "paidMinorUnits" INTEGER NOT NULL DEFAULT 0,
    "reversedMinorUnits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletUserId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "relatedTaskId" TEXT,
    "relatedSubmissionId" TEXT,
    "relatedPayoutId" TEXT,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" "PayoutProviderType" NOT NULL DEFAULT 'MANUAL',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedByUserId" TEXT,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardRule_activity_key" ON "RewardRule"("activity");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletUserId_idx" ON "WalletTransaction"("walletUserId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletUserId_fkey" FOREIGN KEY ("walletUserId") REFERENCES "Wallet"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
