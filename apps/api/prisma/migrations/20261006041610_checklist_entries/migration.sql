-- CreateTable
CREATE TABLE "checklist_entry" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_entry_itemId_position_key" ON "checklist_entry"("itemId", "position");

-- AddForeignKey
ALTER TABLE "checklist_entry" ADD CONSTRAINT "checklist_entry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
