import { prisma } from '@/db/prisma.js';

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

export const insertComment = (row: {
  projectId: string;
  itemId?: string;
  documentId?: string;
  parentId: string | null;
  authorId: string;
  body: string;
}) => {
  return prisma.comment.create({ data: row, include: withAuthor });
};

export const updateCommentRow = (
  id: string,
  data: { body?: string; editedAt?: Date; deletedAt?: Date },
) => {
  return prisma.comment.update({ where: { id }, data, include: withAuthor });
};
