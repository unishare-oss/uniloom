import type { Prisma } from '@/generated/prisma/client.js';

/**
 * Locks the project row until the transaction ends, so transactions that check and then
 * change the same project's rows (owners, blocked-by links, the invite link, join
 * requests) run one at a time. Call it first, before the reads the check depends on.
 */
export const lockProject = (
  tx: Prisma.TransactionClient,
  projectId: string,
) => {
  return tx.$queryRaw`SELECT 1 FROM "project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
};
