-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'TECH_DEBT';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "fixedByItemId" UUID;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_fixedByItemId_fkey" FOREIGN KEY ("fixedByItemId") REFERENCES "item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
