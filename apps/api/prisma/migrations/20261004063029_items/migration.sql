-- CreateEnum
CREATE TYPE "StateCategory" AS ENUM ('BACKLOG', 'UNSTARTED', 'STARTED', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('PROJECT', 'ISSUE', 'SUB_ISSUE', 'FEATURE', 'SLICE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE');

-- CreateTable
CREATE TABLE "state" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT,
    "category" "StateCategory" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "stateId" UUID NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NONE',
    "assigneeId" TEXT,
    "parentId" UUID,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_block" (
    "blockedId" UUID NOT NULL,
    "blockerId" UUID NOT NULL,

    CONSTRAINT "item_block_pkey" PRIMARY KEY ("blockedId","blockerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "state_workspaceId_name_key" ON "state"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "state_workspaceId_key_key" ON "state"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "item_workspaceId_stateId_idx" ON "item"("workspaceId", "stateId");

-- CreateIndex
CREATE INDEX "item_parentId_idx" ON "item"("parentId");

-- CreateIndex
CREATE INDEX "item_assigneeId_idx" ON "item"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "item_workspaceId_number_key" ON "item"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "item_block_blockerId_idx" ON "item_block"("blockerId");

-- AddForeignKey
ALTER TABLE "state" ADD CONSTRAINT "state_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "state"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_block" ADD CONSTRAINT "item_block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_block" ADD CONSTRAINT "item_block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An item can't wait on itself.
ALTER TABLE "item_block" ADD CONSTRAINT "item_block_not_self" CHECK ("blockedId" <> "blockerId");
