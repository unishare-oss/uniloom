import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';

const withCreator = { createdBy: { select: { name: true } } };

/**
 * Locks the project row until the transaction ends, so two people replacing the link at
 * once run one at a time.
 */
export const lockProject = (
  tx: Prisma.TransactionClient,
  projectId: string,
) => {
  return tx.$queryRaw`SELECT 1 FROM "project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
};

/** The project's link that isn't revoked: there is at most one. It may be expired or full. */
export const findCurrent = (projectId: string) => {
  return prisma.invite.findFirst({
    where: { projectId, revokedAt: null },
    include: withCreator,
  });
};

/** Any link with this token, revoked or not, with its project's name. */
export const findByToken = (token: string) => {
  return prisma.invite.findUnique({
    where: { token },
    include: { ...withCreator, project: { select: { name: true } } },
  });
};

/** Pass `prisma` outside a transaction. */
export const revokeCurrent = (
  db: Prisma.TransactionClient,
  projectId: string,
  now: Date,
) => {
  return db.invite.updateMany({
    where: { projectId, revokedAt: null },
    data: { revokedAt: now },
  });
};

export const insertInvite = (
  tx: Prisma.TransactionClient,
  data: {
    projectId: string;
    token: string;
    maxUses: number | null;
    joinApproval: boolean;
    expiresAt: Date;
    createdById: string;
  },
) => {
  return tx.invite.create({ data, include: withCreator });
};

/**
 * Uses one slot if the link is still live: the check and the count are one UPDATE, so
 * the last slot can't be taken twice. False when the link is revoked, expired or full.
 */
export const takeSlot = async (
  tx: Prisma.TransactionClient,
  inviteId: string,
  now: Date,
) => {
  const { count } = await tx.invite.updateMany({
    where: {
      id: inviteId,
      revokedAt: null,
      expiresAt: { gt: now },
      OR: [
        { maxUses: null },
        { useCount: { lt: prisma.invite.fields.maxUses } },
      ],
    },
    data: { useCount: { increment: 1 } },
  });
  return count === 1;
};
