-- CreateEnum
CREATE TYPE "EmergencyServiceType" AS ENUM ('GENERAL', 'POLICE', 'AMBULANCE', 'FIRE', 'OTHER');

-- CreateEnum
CREATE TYPE "SafetyAlertSeverity" AS ENUM ('INFO', 'ADVISORY', 'WARNING');

-- CreateTable
CREATE TABLE "EmergencyNumber" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "service" "EmergencyServiceType" NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT,
    "sourceDescription" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "EmergencyNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyAlert" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "cityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "SafetyAlertSeverity" NOT NULL,
    "sourceDescription" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPhrase" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "englishText" TEXT NOT NULL,
    "translations" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelPhrase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyNumber_countryId_idx" ON "EmergencyNumber"("countryId");

-- CreateIndex
CREATE INDEX "SafetyAlert_countryId_idx" ON "SafetyAlert"("countryId");

-- CreateIndex
CREATE INDEX "SafetyAlert_cityId_idx" ON "SafetyAlert"("cityId");

-- CreateIndex
CREATE INDEX "SafetyAlert_expiresAt_idx" ON "SafetyAlert"("expiresAt");

-- CreateIndex
CREATE INDEX "TravelPhrase_category_idx" ON "TravelPhrase"("category");

-- AddForeignKey
ALTER TABLE "EmergencyNumber" ADD CONSTRAINT "EmergencyNumber_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAlert" ADD CONSTRAINT "SafetyAlert_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAlert" ADD CONSTRAINT "SafetyAlert_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
