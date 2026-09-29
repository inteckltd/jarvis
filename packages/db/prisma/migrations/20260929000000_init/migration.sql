-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "jarvis";

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('DIGITALOCEAN', 'AWS', 'SUPABASE', 'VERCEL', 'EXPO');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('ENV_TOKEN', 'ENCRYPTED_TOKEN', 'AWS_ASSUME_ROLE', 'AWS_ACCESS_KEY');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('PRODUCTION', 'DEVELOPMENT', 'NONE');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('DO_APP', 'DO_DROPLET', 'SUPABASE_PROJECT', 'SUPABASE_FUNCTIONS', 'VERCEL_PROJECT', 'EXPO_APP', 'AWS_EC2');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('BUILDING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MobilePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "MobileBuildStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'FINISHED', 'ERRORED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "label" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "authType" "AuthType" NOT NULL,
    "encryptedCredentials" TEXT,
    "envVarName" TEXT,
    "awsRoleArn" TEXT,
    "awsExternalId" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "type" "ResourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "region" TEXT,
    "liveUrl" TEXT,
    "healthCheckUrl" TEXT,
    "repositoryId" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "encryptedSecrets" TEXT,
    "lastError" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "cpuPercent" DOUBLE PRECISION,
    "memoryPercent" DOUBLE PRECISION,
    "diskPercent" DOUBLE PRECISION,
    "restartCount" INTEGER,
    "dbConnections" INTEGER,
    "dbSizeBytes" BIGINT,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricRollupHourly" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "avgCpu" DOUBLE PRECISION,
    "maxCpu" DOUBLE PRECISION,
    "avgMemory" DOUBLE PRECISION,
    "maxMemory" DOUBLE PRECISION,
    "avgDisk" DOUBLE PRECISION,
    "maxDisk" DOUBLE PRECISION,
    "restarts" INTEGER NOT NULL DEFAULT 0,
    "maxDbSizeBytes" BIGINT,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MetricRollupHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "isUp" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "responseMs" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL,
    "cause" TEXT,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "branch" TEXT,
    "url" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileBuild" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "platform" "MobilePlatform" NOT NULL,
    "profile" TEXT NOT NULL,
    "status" "MobileBuildStatus" NOT NULL,
    "appVersion" TEXT NOT NULL,
    "buildNumber" TEXT NOT NULL,
    "commitSha" TEXT,
    "submittedToStore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MobileBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreVersion" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "platform" "MobilePlatform" NOT NULL,
    "version" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunctionStats" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "invocations" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,

    CONSTRAINT "FunctionStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productionBranch" TEXT NOT NULL DEFAULT 'main',
    "developmentBranch" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "hiddenSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "publicToken" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE INDEX "ProviderAccount_clientId_idx" ON "ProviderAccount"("clientId");

-- CreateIndex
CREATE INDEX "ProviderAccount_provider_idx" ON "ProviderAccount"("provider");

-- CreateIndex
CREATE INDEX "Resource_clientId_environment_idx" ON "Resource"("clientId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_providerAccountId_type_externalId_environment_key" ON "Resource"("providerAccountId", "type", "externalId", "environment");

-- CreateIndex
CREATE INDEX "MetricSnapshot_resourceId_capturedAt_idx" ON "MetricSnapshot"("resourceId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetricRollupHourly_resourceId_hour_key" ON "MetricRollupHourly"("resourceId", "hour");

-- CreateIndex
CREATE INDEX "HealthCheck_resourceId_checkedAt_idx" ON "HealthCheck"("resourceId", "checkedAt");

-- CreateIndex
CREATE INDEX "Deployment_resourceId_startedAt_idx" ON "Deployment"("resourceId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_resourceId_externalId_key" ON "Deployment"("resourceId", "externalId");

-- CreateIndex
CREATE INDEX "MobileBuild_resourceId_createdAt_idx" ON "MobileBuild"("resourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileBuild_resourceId_externalId_key" ON "MobileBuild"("resourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreVersion_resourceId_platform_version_key" ON "StoreVersion"("resourceId", "platform", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionStats_resourceId_periodStart_periodEnd_key" ON "FunctionStats"("resourceId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Repository_clientId_idx" ON "Repository"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_owner_name_key" ON "Repository"("owner", "name");

-- CreateIndex
CREATE INDEX "Task_dueDate_completed_idx" ON "Task"("dueDate", "completed");

-- CreateIndex
CREATE INDEX "Task_clientId_idx" ON "Task"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_publicToken_key" ON "Report"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "Report_clientId_month_key" ON "Report"("clientId", "month");

-- AddForeignKey
ALTER TABLE "ProviderAccount" ADD CONSTRAINT "ProviderAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "ProviderAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricRollupHourly" ADD CONSTRAINT "MetricRollupHourly_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileBuild" ADD CONSTRAINT "MobileBuild_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVersion" ADD CONSTRAINT "StoreVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionStats" ADD CONSTRAINT "FunctionStats_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

