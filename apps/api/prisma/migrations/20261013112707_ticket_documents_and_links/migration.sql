-- AlterTable
ALTER TABLE "document" ADD COLUMN     "createdFromItemId" UUID,
ADD COLUMN     "homeItemId" UUID;

-- CreateTable
CREATE TABLE "item_document" (
    "itemId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_document_pkey" PRIMARY KEY ("itemId","documentId")
);

-- CreateIndex
CREATE INDEX "item_document_documentId_idx" ON "item_document"("documentId");

-- CreateIndex
CREATE INDEX "document_homeItemId_idx" ON "document"("homeItemId");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_homeItemId_fkey" FOREIGN KEY ("homeItemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_createdFromItemId_fkey" FOREIGN KEY ("createdFromItemId") REFERENCES "item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_document" ADD CONSTRAINT "item_document_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_document" ADD CONSTRAINT "item_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
