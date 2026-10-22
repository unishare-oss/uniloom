import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';

const withAuthor = {
  author: { select: { id: true, name: true, image: true } },
};

/** Every comment on a ticket or a document, deleted ones too, oldest first. */
export const findComments = (
  target: { itemId: string } | { documentId: string },
) => {
  return prisma.comment.findMany({
    where: target,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: withAuthor,
  });
};

/**
 * A comment that isn't deleted, with its target's author and whether the target is gone:
 * a deleted ticket, or a document whose home ticket is deleted.
 */
export const findLiveComment = (id: string) => {
  return prisma.comment.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...withAuthor,
      item: { select: { deletedAt: true, createdById: true } },
      document: {
        select: {
          authorId: true,
          homeItem: { select: { deletedAt: true } },
        },
      },
    },
  });
};

/** Which of `ids` are members of the project, with their names. */
export const findMentionableMembers = (
  tx: Prisma.TransactionClient,
  projectId: string,
  ids: string[],
) => {
  return tx.member.findMany({
    where: { projectId, userId: { in: ids } },
    select: { user: { select: { id: true, name: true } } },
  });
};

/** The names of the people a set of comments mention. Gone accounts are simply missing. */
export const findUserNames = (ids: string[]) => {
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
};

export const insertComment = (
  row: {
    projectId: string;
    itemId?: string;
    documentId?: string;
    parentId: string | null;
    authorId: string;
    body: string;
    mentionIds?: string[];
  },
  tx: Prisma.TransactionClient = prisma,
) => {
  return tx.comment.create({ data: row, include: withAuthor });
};

export const updateCommentRow = (
  id: string,
  data: {
    body?: string;
    mentionIds?: string[];
    editedAt?: Date;
    deletedAt?: Date;
  },
  tx: Prisma.TransactionClient = prisma,
) => {
  return tx.comment.update({ where: { id }, data, include: withAuthor });
};
