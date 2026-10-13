-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "invite" ADD COLUMN     "joinApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "join_request" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "inviteId" UUID NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "join_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "join_request_projectId_status_idx" ON "join_request"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "join_request_inviteId_userId_key" ON "join_request"("inviteId", "userId");

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A person waits at most once per project, whichever link they asked through.
CREATE UNIQUE INDEX "join_request_one_pending_per_project" ON "join_request"("projectId", "userId") WHERE "status" = 'PENDING';
