import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';
import type { ActivityDetail, ItemAgent } from './item.types.js';

/** Adds one row inside the caller's transaction, so a change never lacks its record. */
export const insertActivity = (
  tx: Prisma.TransactionClient,
  row: {
    userId: string | null;
    projectId: string;
    itemId: string;
    agent?: ItemAgent;
  } & ActivityDetail,
) => {
  return tx.activity.create({
    data: {
      userId: row.userId,
      clientId: row.agent?.clientId ?? null,
      agentName: row.agent?.clientName ?? null,
      action: row.action,
      projectId: row.projectId,
      itemId: row.itemId,
      detail: row.detail,
    },
  });
};

/** The item's newest row, read inside the caller's transaction. */
export const findLatestActivity = (
  tx: Prisma.TransactionClient,
  itemId: string,
) => {
  return tx.activity.findFirst({
    where: { itemId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { action: true, detail: true },
  });
};

/** The item's latest 50 rows, newest first, with the person's name and image. */
export const findActivity = (itemId: string) => {
  return prisma.activity.findMany({
    where: { itemId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
    include: { user: { select: { name: true, image: true } } },
  });
};
