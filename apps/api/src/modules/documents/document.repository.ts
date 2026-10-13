import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';
import type { DocumentKind, DocumentStatus } from '@/generated/prisma/enums.js';

const withAuthor = {
  author: { select: { id: true, name: true, image: true } },
};

/** The ticket a document belongs to: its key parts, and the fields the edit rule reads. */
const withHomeItem = {
  homeItem: {
    select: {
      id: true,
      number: true,
      title: true,
      assigneeId: true,
      deletedAt: true,
      project: { select: { keyPrefix: true } },
    },
  },
};

/** The tickets a document was raised on and fixed by; `deletedAt` so a deleted one is hidden. */
const withOrigin = {
  createdFromItem: {
    select: {
      id: true,
      number: true,
      deletedAt: true,
      project: { select: { keyPrefix: true } },
    },
  },
  fixedByItem: {
    select: {
      id: true,
      number: true,
      deletedAt: true,
      project: { select: { keyPrefix: true } },
    },
  },
};

/** One document in full: author, home ticket, the ticket it was created from, linking tickets. */
const documentView = {
  ...withAuthor,
  ...withHomeItem,
  supersededBy: { select: { id: true, number: true, title: true } },
  ...withOrigin,
  links: {
    where: { item: { deletedAt: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      item: {
        select: {
          id: true,
          number: true,
          title: true,
          state: { select: { name: true, category: true } },
          project: { select: { keyPrefix: true } },
        },
      },
    },
  },
} as const;

/**
 * Newest edit first, at most 200, archived ones only when asked, ticket documents only
 * when asked. The body is not read.
 */
export const findDocuments = (
  projectId: string,
  filter: {
    kind?: DocumentKind;
    q?: string;
    archived: boolean;
    includeTicketDocuments: boolean;
  },
) => {
  return prisma.document.findMany({
    where: {
      projectId,
      kind: filter.kind,
      ...(filter.q && {
        title: { contains: filter.q, mode: 'insensitive' as const },
      }),
      ...(!filter.archived && { archivedAt: null }),
      ...(filter.includeTicketDocuments
        ? { OR: [{ homeItemId: null }, { homeItem: { deletedAt: null } }] }
        : { homeItemId: null }),
    },
    omit: { body: true },
    include: { ...withAuthor, ...withHomeItem, ...withOrigin },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
};

export const findDocument = (id: string) => {
  return prisma.document.findUnique({ where: { id }, include: documentView });
};

export const insertDocument = (
  data: {
    projectId: string;
    authorId: string;
    kind: DocumentKind;
    title: string;
    purpose?: string;
    body?: string;
    homeItemId?: string;
    createdFromItemId?: string;
    number?: number;
    status?: DocumentStatus;
  },
  db: Prisma.TransactionClient = prisma,
) => {
  return db.document.create({ data, include: documentView });
};

/**
 * The next number for a kind in a project (ADR-7). Locks the project row first, so two
 * creates at the same moment get different numbers. Call it in a transaction.
 */
export const nextDocumentNumber = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  kind: DocumentKind,
) => {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId}::uuid FOR UPDATE`;
  const { _max } = await tx.document.aggregate({
    where: { projectId, kind },
    _max: { number: true },
  });
  return (_max.number ?? 0) + 1;
};

/**
 * Sets the status only while the document still has the status the caller read (`from`),
 * so two moves at the same moment can't both apply. Returns how many rows changed: 0
 * means someone else moved it first. Call it in a transaction.
 */
export const moveDocumentStatus = async (
  tx: Prisma.TransactionClient,
  id: string,
  from: DocumentStatus | null,
  data: {
    status: DocumentStatus;
    supersededById?: string | null;
    fixedByItemId?: string | null;
  },
) => {
  const { count } = await tx.document.updateMany({
    where: { id, status: from },
    data,
  });
  return count;
};

/** Links a ticket to a Knowledge document; linking twice changes nothing. */
export const linkItem = (
  tx: Prisma.TransactionClient,
  itemId: string,
  documentId: string,
) => {
  return tx.itemDocument.upsert({
    where: { itemId_documentId: { itemId, documentId } },
    create: { itemId, documentId },
    update: {},
  });
};

export const updateDocument = (
  id: string,
  data: {
    title?: string;
    purpose?: string;
    body?: string;
    archivedAt?: Date | null;
    status?: DocumentStatus;
    supersededById?: string | null;
  },
) => {
  return prisma.document.update({ where: { id }, data, include: documentView });
};
