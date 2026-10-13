-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'OPEN', 'FIXED', 'WONT_FIX');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'ADR';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "number" INTEGER,
ADD COLUMN     "status" "DocumentStatus",
ADD COLUMN     "supersededById" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "document_projectId_kind_number_key" ON "document"("projectId", "kind", "number");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

