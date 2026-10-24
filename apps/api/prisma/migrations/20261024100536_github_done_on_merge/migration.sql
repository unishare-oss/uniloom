-- AlterTable
ALTER TABLE "project" ADD COLUMN     "doneOnMerge" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pull_request_item" ADD COLUMN     "settledAt" TIMESTAMP(3);
