import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';

/** Call it first, before reading the links you check, so concurrent adds run one at a time. */
export { lockProject } from '@/db/locks.js';

/** Every blocked-by link in the project. */
export const findLinks = (tx: Prisma.TransactionClient, projectId: string) => {
  return tx.itemBlock.findMany({
    where: { blocked: { projectId } },
    select: { blockedId: true, blockerId: true },
  });
};

/** Records that `blockedId` waits on `blockerId`. */
export const insertLink = (
  tx: Prisma.TransactionClient,
  blockedId: string,
  blockerId: string,
) => {
  return tx.itemBlock.create({ data: { blockedId, blockerId } });
};

export const deleteLink = (blockedId: string, blockerId: string) => {
  return prisma.itemBlock.deleteMany({ where: { blockedId, blockerId } });
};
