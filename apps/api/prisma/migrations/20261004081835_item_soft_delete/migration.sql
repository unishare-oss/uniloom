-- DropIndex
DROP INDEX "item_workspaceId_stateId_idx";

-- AlterTable
ALTER TABLE "item" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "item_workspaceId_stateId_deletedAt_idx" ON "item"("workspaceId", "stateId", "deletedAt");
