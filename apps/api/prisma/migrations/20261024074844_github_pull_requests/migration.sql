-- CreateEnum
CREATE TYPE "PullRequestState" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- CreateTable
CREATE TABLE "github_installation" (
    "id" BIGINT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "github_installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repository" (
    "id" BIGINT NOT NULL,
    "installationId" BIGINT NOT NULL,
    "fullName" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "github_repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_repository" (
    "projectId" UUID NOT NULL,
    "repositoryId" BIGINT NOT NULL,

    CONSTRAINT "project_repository_pkey" PRIMARY KEY ("projectId","repositoryId")
);

-- CreateTable
CREATE TABLE "github_delivery" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "github_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_request" (
    "id" UUID NOT NULL,
    "repositoryId" BIGINT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "headRef" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "baseRef" TEXT NOT NULL,
    "state" "PullRequestState" NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "mergedByLogin" TEXT,
    "authorLogin" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "githubUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_request_item" (
    "pullRequestId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "closes" BOOLEAN NOT NULL,

    CONSTRAINT "pull_request_item_pkey" PRIMARY KEY ("pullRequestId","itemId")
);

-- CreateTable
CREATE TABLE "check_suite" (
    "id" BIGINT NOT NULL,
    "repositoryId" BIGINT NOT NULL,
    "headSha" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "conclusion" TEXT,

    CONSTRAINT "check_suite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "github_repository_installationId_idx" ON "github_repository"("installationId");

-- CreateIndex
CREATE INDEX "project_repository_repositoryId_idx" ON "project_repository"("repositoryId");

-- CreateIndex
CREATE INDEX "github_delivery_processedAt_failedAt_nextAttemptAt_id_idx" ON "github_delivery"("processedAt", "failedAt", "nextAttemptAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_repositoryId_number_key" ON "pull_request"("repositoryId", "number");

-- CreateIndex
CREATE INDEX "pull_request_item_itemId_idx" ON "pull_request_item"("itemId");

-- CreateIndex
CREATE INDEX "check_suite_repositoryId_headSha_idx" ON "check_suite"("repositoryId", "headSha");

-- AddForeignKey
ALTER TABLE "github_repository" ADD CONSTRAINT "github_repository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "github_installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repository" ADD CONSTRAINT "project_repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repository" ADD CONSTRAINT "project_repository_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "github_repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request" ADD CONSTRAINT "pull_request_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "github_repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_item" ADD CONSTRAINT "pull_request_item_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "pull_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_item" ADD CONSTRAINT "pull_request_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_suite" ADD CONSTRAINT "check_suite_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "github_repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
