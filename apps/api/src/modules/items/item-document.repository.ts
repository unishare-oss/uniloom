import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';

/**
 * The documents a ticket shows: its own (home) and the Knowledge documents linked to it,
 * plus its parent's when there is a parent. No bodies. Oldest first.
 */
export const findItemDocuments = (itemId: string, parentId: string | null) => {
  const itemIds = parentId ? [itemId, parentId] : [itemId];
  return prisma.document.findMany({
    where: {
      OR: [
        { homeItemId: { in: itemIds } },
        { links: { some: { itemId: { in: itemIds } } } },
      ],
    },
    select: {
      id: true,
      kind: true,
      number: true,
      status: true,
      title: true,
      archivedAt: true,
      homeItemId: true,
      links: { where: { itemId: { in: itemIds } }, select: { itemId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
};

/** Links a Knowledge document to a ticket; linking twice changes nothing. */
export const upsertLink = (
  itemId: string,
  documentId: string,
  db: Prisma.TransactionClient = prisma,
) => {
  return db.itemDocument.upsert({
    where: { itemId_documentId: { itemId, documentId } },
    create: { itemId, documentId },
    update: {},
  });
};

export const deleteLink = (itemId: string, documentId: string) => {
  return prisma.itemDocument.deleteMany({ where: { itemId, documentId } });
};
