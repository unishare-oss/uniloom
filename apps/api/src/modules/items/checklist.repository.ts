import type { Prisma } from '@/generated/prisma/client.js';

/** One entry of the item: an entry of another item is not found. */
export const findEntry = (
  tx: Prisma.TransactionClient,
  itemId: string,
  entryId: string,
) => {
  return tx.checklistEntry.findFirst({ where: { id: entryId, itemId } });
};

export const insertEntry = (
  tx: Prisma.TransactionClient,
  itemId: string,
  text: string,
  position: number,
) => {
  return tx.checklistEntry.create({ data: { itemId, text, position } });
};

export const updateEntry = (
  tx: Prisma.TransactionClient,
  id: string,
  data: { text?: string; done?: boolean; evidence?: string | null },
) => {
  return tx.checklistEntry.update({ where: { id }, data });
};

export const deleteEntry = (tx: Prisma.TransactionClient, id: string) => {
  return tx.checklistEntry.delete({ where: { id } });
};

export const setEntryPosition = (
  tx: Prisma.TransactionClient,
  id: string,
  position: number,
) => {
  return tx.checklistEntry.update({ where: { id }, data: { position } });
};

/** Removes every entry of the item. */
export const deleteEntries = (tx: Prisma.TransactionClient, itemId: string) => {
  return tx.checklistEntry.deleteMany({ where: { itemId } });
};
