-- CreateTable
CREATE TABLE "invite" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_token_key" ON "invite"("token");

-- CreateIndex
CREATE INDEX "invite_projectId_idx" ON "invite"("projectId");

-- AddForeignKey
ALTER TABLE "invite" ADD CONSTRAINT "invite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite" ADD CONSTRAINT "invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A project has at most one link that isn't revoked. The service revokes the old link
-- before inserting a new one; the index also holds when two creates race.
CREATE UNIQUE INDEX "invite_one_live_per_project" ON "invite"("projectId") WHERE "revokedAt" IS NULL;

-- A limit is at least one person (null = no limit).
ALTER TABLE "invite" ADD CONSTRAINT "invite_max_uses" CHECK ("maxUses" IS NULL OR "maxUses" >= 1);
