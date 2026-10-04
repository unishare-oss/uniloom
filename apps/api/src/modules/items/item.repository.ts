import { prisma } from '@/db/prisma.js';
import type { ItemKind, Priority } from '@/generated/prisma/enums.js';

const itemView = {
  workspace: { select: { keyPrefix: true, mode: true } },
  state: { select: { id: true, name: true, key: true, category: true } },
  blockedBy: { select: { blockerId: true } },
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

/** The workspace's trash: deleted items, most recently deleted first. */
export const listDeletedItems = (workspaceId: string) => {
  return prisma.item.findMany({
    where: { workspaceId, deletedAt: { not: null } },
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

export const listItems = (workspaceId: string) => {
  return prisma.item.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { number: 'asc' },
    include: itemView,
  });
};

/** Takes the workspace's next number and creates the item, in one transaction. */
export const createItem = (data: {
  workspaceId: string;
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
    // The update locks the workspace row, so concurrent creates get distinct numbers.
    const { nextItemNumber } = await tx.workspace.update({
      where: { id: data.workspaceId },
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
  return prisma.item.update({ where: { id }, data, include: itemView });
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
export const findFirstState = (workspaceId: string) => {
  return prisma.state.findFirstOrThrow({
    where: { workspaceId },
    orderBy: { position: 'asc' },
  });
};

/**
 * Adds "blocked waits on blocker" once `check` accepts the workspace's current links. The
 * workspace row is locked for the whole transaction, so two concurrent adds can't both
 * pass the check (e.g. A→B and B→A, which together would be a loop).
 */
export const createLinkChecked = (
  workspaceId: string,
  blockedId: string,
  blockerId: string,
  check: (links: { blockedId: string; blockerId: string }[]) => void,
) => {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "workspace" WHERE "id" = ${workspaceId}::uuid FOR UPDATE`;
    const links = await tx.itemBlock.findMany({
      where: { blocked: { workspaceId } },
      select: { blockedId: true, blockerId: true },
    });
    check(links);
    await tx.itemBlock.create({ data: { blockedId, blockerId } });
  });
};

export const deleteLink = (blockedId: string, blockerId: string) => {
  return prisma.itemBlock.deleteMany({ where: { blockedId, blockerId } });
};
