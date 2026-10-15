import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';

const withUser = { user: { select: { name: true, email: true, image: true } } };

/** The person's waiting request in the project, whichever link it came through. */
export const findPending = (
  db: Prisma.TransactionClient,
  projectId: string,
  userId: string,
) => {
  return db.joinRequest.findFirst({
    where: { projectId, userId, status: 'PENDING' },
  });
};

/** The person's request through this link, decided or not: they already hold its slot. */
export const findForInvite = (
  db: Prisma.TransactionClient,
  inviteId: string,
  userId: string,
) => {
  return db.joinRequest.findUnique({
    where: { inviteId_userId: { inviteId, userId } },
  });
};

export const insertRequest = (
  tx: Prisma.TransactionClient,
  data: { projectId: string; userId: string; inviteId: string },
) => {
  return tx.joinRequest.create({ data });
};

/**
 * A decided request waits again: the person asked once more through the same link. The
 * status check is part of the UPDATE, so it never overwrites a request that changed
 * meanwhile.
 */
export const reopenIfDecided = (
  tx: Prisma.TransactionClient,
  id: string,
  now: Date,
) => {
  return tx.joinRequest.updateMany({
    where: { id, status: { not: 'PENDING' } },
    data: { status: 'PENDING', requestedAt: now, decidedById: null },
  });
};

/** The project's waiting requests, oldest first. */
export const findWaiting = (projectId: string) => {
  return prisma.joinRequest.findMany({
    where: { projectId, status: 'PENDING' },
    include: withUser,
    orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
  });
};

export const findById = (tx: Prisma.TransactionClient, id: string) => {
  return tx.joinRequest.findUnique({ where: { id }, include: withUser });
};

/**
 * Decides the request if it still waits: the check is part of the UPDATE, so a decision
 * racing the requester's cancel has one winner. False when it no longer waits.
 */
export const decideIfPending = async (
  tx: Prisma.TransactionClient,
  id: string,
  status: 'APPROVED' | 'DECLINED',
  decidedById: string,
) => {
  const { count } = await tx.joinRequest.updateMany({
    where: { id, status: 'PENDING' },
    data: { status, decidedById },
  });
  return count === 1;
};

/** The person's waiting requests in every project, oldest first, with the project's name. */
export const findMineWaiting = (userId: string) => {
  return prisma.joinRequest.findMany({
    where: { userId, status: 'PENDING' },
    include: { project: { select: { name: true, keyPrefix: true } } },
    orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
  });
};

/** The request, if it is this person's own. */
export const findOwn = (id: string, userId: string) => {
  return prisma.joinRequest.findFirst({ where: { id, userId } });
};

/**
 * Cancels the request if it still waits: one conditional UPDATE, so a cancel racing an
 * approval has one winner. False when it was decided meanwhile.
 */
export const cancelIfPending = async (id: string, userId: string) => {
  const { count } = await prisma.joinRequest.updateMany({
    where: { id, userId, status: 'PENDING' },
    data: { status: 'CANCELED' },
  });
  return count === 1;
};
