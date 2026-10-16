CREATE TABLE "comment" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "itemId" UUID,
    "documentId" UUID,
    "parentId" UUID,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comment_itemId_createdAt_idx" ON "comment"("itemId", "createdAt");
CREATE INDEX "comment_documentId_createdAt_idx" ON "comment"("documentId", "createdAt");
CREATE INDEX "comment_parentId_idx" ON "comment"("parentId");

ALTER TABLE "comment" ADD CONSTRAINT "comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment" ADD CONSTRAINT "comment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment" ADD CONSTRAINT "comment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment" ADD CONSTRAINT "comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment" ADD CONSTRAINT "comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exactly one target: a ticket or a document (ADR-0021).
ALTER TABLE "comment" ADD CONSTRAINT "comment_one_target" CHECK (num_nonnulls("itemId", "documentId") = 1);
