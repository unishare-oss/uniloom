import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';
import type { ItemKind, Priority } from '@/generated/prisma/enums.js';

const itemView = {
  project: {
    select: {
      keyPrefix: true,
      mode: true,
      checklistRequired: true,
      checklistMin: true,
      checklistMax: true,
    },
  },
  state: { select: { id: true, name: true, key: true, category: true } },
  blockedBy: { select: { blockerId: true } },
  checklist: { orderBy: { position: 'asc' } },
} as const;

// Deleted items (deletedAt set) are kept in the table but never returned: every lookup
// below filters them out, so nothing outside this file has to remember.

export const findItem = (id: string) => {
  return prisma.item.findFirst({
    where: { id, deletedAt: null },
    include: itemView,
  });
};

/** A deleted item: the one lookup that sees them, for restoring. */
export const findDeletedItem = (id: string) => {
  return prisma.item.findFirst({
    where: { id, deletedAt: { not: null } },
    include: itemView,
  });
};

/** The project's trash: deleted items, most recently deleted first. */
export const listDeletedItems = (projectId: string) => {
  return prisma.item.findMany({
    where: { projectId, deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    include: itemView,
  });
};

export const restoreItem = (id: string) => {
  return prisma.item.update({
    where: { id },
    data: { deletedAt: null },
    include: itemView,
  });
};

export const listItems = (projectId: string) => {
  return prisma.item.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { number: 'asc' },
    include: itemView,
  });
};

/** Takes the project's next number and creates the item, in one transaction. */
export const createItem = (data: {
  projectId: string;
  kind: ItemKind;
  title: string;
  description?: string;
  stateId: string;
  priority?: Priority;
  assigneeId?: string | null;
  parentId?: string | null;
  createdById: string;
}) => {
  return prisma.$transaction(async (tx) => {
    // The update locks the project row, so concurrent creates get distinct numbers.
    const { nextItemNumber } = await tx.project.update({
      where: { id: data.projectId },
      data: { nextItemNumber: { increment: 1 } },
      select: { nextItemNumber: true },
    });
    return tx.item.create({
      data: { ...data, number: nextItemNumber - 1 },
      include: itemView,
    });
  });
};

export const updateItem = (
  tx: Prisma.TransactionClient,
  id: string,
  data: {
    title?: string;
    description?: string;
    priority?: Priority;
    assigneeId?: string | null;
    stateId?: string;
    parentId?: string | null;
  },
) => {
  return tx.item.update({ where: { id }, data, include: itemView });
};

/** The live item's kind and state, for the parent of an item that just moved. */
export const findParent = (tx: Prisma.TransactionClient, id: string) => {
  return tx.item.findFirst({
    where: { id, deletedAt: null },
    select: { kind: true, state: { select: { category: true } } },
  });
};

/** A parent's live children with their state category. */
export const findChildren = (
  tx: Prisma.TransactionClient,
  parentId: string,
) => {
  return tx.item.findMany({
    where: { parentId, deletedAt: null },
    select: { state: { select: { category: true } } },
  });
};

/** The project's first Done state: where a finished feature goes. */
export const findFirstDoneState = (
  tx: Prisma.TransactionClient,
  projectId: string,
) => {
  return tx.state.findFirstOrThrow({
    where: { projectId, category: 'DONE' },
    orderBy: { position: 'asc' },
  });
};

/** Soft delete: marks the item deleted and removes its blocked-by links, together. */
export const deleteItem = (id: string) => {
  return prisma.$transaction([
    prisma.itemBlock.deleteMany({
      where: { OR: [{ blockedId: id }, { blockerId: id }] },
    }),
    prisma.item.update({ where: { id }, data: { deletedAt: new Date() } }),
  ]);
};

export const countChildren = (id: string) => {
  return prisma.item.count({ where: { parentId: id, deletedAt: null } });
};

export const findState = (id: string) => {
  return prisma.state.findUnique({ where: { id } });
};

/** The first column on the board: where a new item starts. */
export const findFirstState = (projectId: string) => {
  return prisma.state.findFirstOrThrow({
    where: { projectId },
    orderBy: { position: 'asc' },
  });
};

/**
 * Locks the project row until the transaction ends, so concurrent blocked-by adds run one
 * at a time. Call it first, before reading the links you check.
 */
export const lockProject = (
  tx: Prisma.TransactionClient,
  projectId: string,
) => {
  return tx.$queryRaw`SELECT 1 FROM "project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
};

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

/**
 * Locks the item row until the transaction ends, so concurrent checklist changes on it
 * run one at a time. Call it first, before reading the entries you change.
 */
export const lockItem = (tx: Prisma.TransactionClient, itemId: string) => {
  return tx.$queryRaw`SELECT 1 FROM "item" WHERE "id" = ${itemId}::uuid FOR UPDATE`;
};

/** The item's checklist entries, in order. */
export const findChecklist = (tx: Prisma.TransactionClient, itemId: string) => {
  return tx.checklistEntry.findMany({
    where: { itemId },
    orderBy: { position: 'asc' },
  });
};

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
