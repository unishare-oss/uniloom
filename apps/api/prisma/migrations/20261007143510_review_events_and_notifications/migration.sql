-- CreateTable
CREATE TABLE "review_event" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "actorId" TEXT,
    "fromStateId" UUID NOT NULL,
    "toStateId" UUID NOT NULL,
    "fromStateKey" TEXT,
    "toStateKey" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientIds" TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "review_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "recipientId" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_event_processedAt_failedAt_nextAttemptAt_id_idx" ON "review_event"("processedAt", "failedAt", "nextAttemptAt", "id");

-- CreateIndex
CREATE INDEX "review_event_itemId_submittedAt_id_idx" ON "review_event"("itemId", "submittedAt", "id");

-- CreateIndex
CREATE INDEX "notification_recipientId_createdAt_id_idx" ON "notification"("recipientId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "notification_recipientId_itemId_createdAt_id_idx" ON "notification"("recipientId", "itemId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_eventId_recipientId_key" ON "notification"("eventId", "recipientId");

-- AddForeignKey
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "review_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
