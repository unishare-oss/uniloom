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

/** A decided request waits again: the person asked once more through the same link. */
export const reopen = (tx: Prisma.TransactionClient, id: string, now: Date) => {
  return tx.joinRequest.update({
    where: { id },
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

export const decide = (
  tx: Prisma.TransactionClient,
  id: string,
  status: 'APPROVED' | 'DECLINED',
  decidedById: string,
) => {
  return tx.joinRequest.update({
    where: { id },
    data: { status, decidedById },
  });
};
