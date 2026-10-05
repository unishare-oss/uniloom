-- Workspace becomes Project; the PROJECT item kind goes away (a project is now the container).
-- Hand-written so tables and data are renamed in place, not dropped.

-- Table, enum
ALTER TABLE "workspace" RENAME TO "project";
ALTER TABLE "project" RENAME CONSTRAINT "workspace_pkey" TO "project_pkey";
ALTER INDEX "workspace_keyPrefix_key" RENAME TO "project_keyPrefix_key";
ALTER TYPE "WorkspaceMode" RENAME TO "ProjectMode";

-- Columns
ALTER TABLE "member" RENAME COLUMN "workspaceId" TO "projectId";
ALTER TABLE "state" RENAME COLUMN "workspaceId" TO "projectId";
ALTER TABLE "item" RENAME COLUMN "workspaceId" TO "projectId";

-- Foreign keys
ALTER TABLE "member" RENAME CONSTRAINT "member_workspaceId_fkey" TO "member_projectId_fkey";
ALTER TABLE "state" RENAME CONSTRAINT "state_workspaceId_fkey" TO "state_projectId_fkey";
ALTER TABLE "item" RENAME CONSTRAINT "item_workspaceId_fkey" TO "item_projectId_fkey";

-- Indexes
ALTER INDEX "item_workspaceId_number_key" RENAME TO "item_projectId_number_key";
ALTER INDEX "item_workspaceId_stateId_deletedAt_idx" RENAME TO "item_projectId_stateId_deletedAt_idx";
ALTER INDEX "state_workspaceId_key_key" RENAME TO "state_projectId_key_key";
ALTER INDEX "state_workspaceId_name_key" RENAME TO "state_projectId_name_key";

-- Data: old PROJECT items become top-level tasks
UPDATE "item" SET "parentId" = NULL WHERE "parentId" IN (SELECT "id" FROM "item" WHERE "kind" = 'PROJECT');
UPDATE "item" SET "kind" = 'TASK' WHERE "kind" = 'PROJECT';

-- ItemKind without PROJECT
CREATE TYPE "ItemKind_new" AS ENUM ('TASK', 'SUBTASK', 'FEATURE', 'SLICE');
ALTER TABLE "item" ALTER COLUMN "kind" TYPE "ItemKind_new" USING ("kind"::text::"ItemKind_new");
DROP TYPE "ItemKind";
ALTER TYPE "ItemKind_new" RENAME TO "ItemKind";
