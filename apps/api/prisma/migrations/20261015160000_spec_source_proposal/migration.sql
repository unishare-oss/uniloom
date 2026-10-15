ALTER TABLE "document" ADD COLUMN "sourceProposalId" UUID;
CREATE INDEX "document_sourceProposalId_idx" ON "document"("sourceProposalId");
ALTER TABLE "document" ADD CONSTRAINT "document_sourceProposalId_fkey" FOREIGN KEY ("sourceProposalId") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
