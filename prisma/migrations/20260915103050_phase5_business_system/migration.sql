-- CreateEnum
CREATE TYPE "BusinessClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BusinessUpdateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "ownerUserId" TEXT;

-- CreateTable
CREATE TABLE "BusinessClaim" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "claimantUserId" TEXT NOT NULL,
    "status" "BusinessClaimStatus" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT,
    "evidenceDescription" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "BusinessClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUpdateRequest" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "BusinessUpdateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessUpdateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessClaim_placeId_idx" ON "BusinessClaim"("placeId");

-- CreateIndex
CREATE INDEX "BusinessClaim_claimantUserId_idx" ON "BusinessClaim"("claimantUserId");

-- CreateIndex
CREATE INDEX "BusinessClaim_status_idx" ON "BusinessClaim"("status");

-- CreateIndex
CREATE INDEX "BusinessUpdateRequest_placeId_idx" ON "BusinessUpdateRequest"("placeId");

-- CreateIndex
CREATE INDEX "BusinessUpdateRequest_status_idx" ON "BusinessUpdateRequest"("status");

-- CreateIndex
CREATE INDEX "Place_ownerUserId_idx" ON "Place"("ownerUserId");

-- AddForeignKey
ALTER TABLE "BusinessClaim" ADD CONSTRAINT "BusinessClaim_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessClaim" ADD CONSTRAINT "BusinessClaim_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUpdateRequest" ADD CONSTRAINT "BusinessUpdateRequest_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUpdateRequest" ADD CONSTRAINT "BusinessUpdateRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
