-- CreateEnum
CREATE TYPE "LabelColor" AS ENUM ('GRAY', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'PINK');

-- CreateTable
CREATE TABLE "label" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" "LabelColor" NOT NULL,
    "group" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_label" (
    "itemId" UUID NOT NULL,
    "labelId" UUID NOT NULL,

    CONSTRAINT "item_label_pkey" PRIMARY KEY ("itemId","labelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "label_projectId_name_key" ON "label"("projectId", "name");

-- CreateIndex
CREATE INDEX "item_label_labelId_idx" ON "item_label"("labelId");

-- AddForeignKey
ALTER TABLE "label" ADD CONSTRAINT "label_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_label" ADD CONSTRAINT "item_label_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_label" ADD CONSTRAINT "item_label_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
