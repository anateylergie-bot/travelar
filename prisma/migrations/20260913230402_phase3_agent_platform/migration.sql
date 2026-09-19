-- CreateEnum
CREATE TYPE "AgentApplicationStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('NEW_PLACE', 'UPDATE', 'FIELD_VERIFICATION', 'CLOSURE', 'CONTACT_VERIFICATION', 'LOCATION_VERIFICATION', 'PHOTO_TASK');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'REJECTED_BY_AGENT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO');

-- CreateEnum
CREATE TYPE "AgentLevel" AS ENUM ('LEVEL_1_NEW', 'LEVEL_2_CONTRIBUTOR', 'LEVEL_3_VERIFIED_CONTRIBUTOR', 'LEVEL_4_SENIOR_VERIFIER', 'LEVEL_5_CITY_DATA_LEAD');

-- DropIndex
DROP INDEX "place_name_trgm_idx";

-- CreateTable
CREATE TABLE "LocalDataAgentProfile" (
    "userId" TEXT NOT NULL,
    "status" "AgentApplicationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "city" TEXT,
    "area" TEXT,
    "preferredLanguage" TEXT,
    "availability" TEXT,
    "experience" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "LocalDataAgentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrainingModule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requiredForTaskTypes" "TaskType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTrainingCompletion" (
    "id" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrainingCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "placeId" TEXT,
    "cityId" TEXT,
    "categoryId" TEXT,
    "assignedAgentId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "placeExists" BOOLEAN,
    "nameMatches" BOOLEAN,
    "locationMatches" BOOLEAN,
    "appearsOperational" BOOLEAN,
    "contactVerified" BOOLEAN,
    "openingInfoChecked" BOOLEAN,
    "notes" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "gpsAccuracyMeters" DOUBLE PRECISION,
    "proposedPlaceData" JSONB,
    "reviewStatus" "SubmissionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exifStrippedAt" TIMESTAMP(3),

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentReputation" (
    "userId" TEXT NOT NULL,
    "accuracyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedTasksCount" INTEGER NOT NULL DEFAULT 0,
    "approvedSubmissionsCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedSubmissionsCount" INTEGER NOT NULL DEFAULT 0,
    "level" "AgentLevel" NOT NULL DEFAULT 'LEVEL_1_NEW',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentReputation_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "LocalDataAgentProfile_status_idx" ON "LocalDataAgentProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingModule_slug_key" ON "TrainingModule"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrainingCompletion_agentUserId_moduleId_key" ON "AgentTrainingCompletion"("agentUserId", "moduleId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_assignedAgentId_idx" ON "Task"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Task_cityId_idx" ON "Task"("cityId");

-- CreateIndex
CREATE INDEX "TaskSubmission_taskId_idx" ON "TaskSubmission"("taskId");

-- CreateIndex
CREATE INDEX "TaskSubmission_agentUserId_idx" ON "TaskSubmission"("agentUserId");

-- CreateIndex
CREATE INDEX "TaskSubmission_reviewStatus_idx" ON "TaskSubmission"("reviewStatus");

-- CreateIndex
CREATE INDEX "Evidence_submissionId_idx" ON "Evidence"("submissionId");

-- AddForeignKey
ALTER TABLE "LocalDataAgentProfile" ADD CONSTRAINT "LocalDataAgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrainingCompletion" ADD CONSTRAINT "AgentTrainingCompletion_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrainingCompletion" ADD CONSTRAINT "AgentTrainingCompletion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReputation" ADD CONSTRAINT "AgentReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
