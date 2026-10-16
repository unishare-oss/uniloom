import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';

const withCreator = { createdBy: { select: { name: true } } };

/** Call it first, so two people replacing the link or deciding a request run one at a time. */
export { lockProject } from '@/db/locks.js';

/** The project's link that isn't revoked: there is at most one. It may be expired or full. */
export const findCurrent = (projectId: string) => {
  return prisma.invite.findFirst({
    where: { projectId, revokedAt: null },
    include: withCreator,
  });
};

/** Any link with this token, revoked or not, with its project's name; none if the project is deleted. */
export const findByToken = (token: string) => {
  return prisma.invite.findFirst({
    where: { token, project: { deletedAt: null } },
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

/**
 * Deletes the project's links revoked before `cutoff`, with their decided requests
 * (cascade). A link someone still waits on is kept: requests outlive their link.
 */
export const deleteOldRevoked = (
  tx: Prisma.TransactionClient,
  projectId: string,
  cutoff: Date,
) => {
  return tx.invite.deleteMany({
    where: {
      projectId,
      revokedAt: { lt: cutoff },
      joinRequests: { none: { status: 'PENDING' } },
    },
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
