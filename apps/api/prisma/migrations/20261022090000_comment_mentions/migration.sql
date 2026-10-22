-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('REVIEW', 'MENTION');

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "commentId" UUID,
ADD COLUMN     "kind" "NotificationKind" NOT NULL DEFAULT 'REVIEW',
ALTER COLUMN "eventId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "comment" ADD COLUMN     "mentionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "notification_commentId_recipientId_key" ON "notification"("commentId", "recipientId");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A notification comes from exactly one source: a review event or a mentioning comment.
ALTER TABLE "notification" ADD CONSTRAINT "notification_one_source" CHECK (
  (kind = 'REVIEW' AND "eventId" IS NOT NULL AND "commentId" IS NULL)
  OR (kind = 'MENTION' AND "commentId" IS NOT NULL AND "eventId" IS NULL)
);
