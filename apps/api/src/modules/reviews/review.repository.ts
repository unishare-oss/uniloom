import { prisma } from '@/db/prisma.js';
import type { ReviewQuery, ReviewCursor } from './review.types.js';

export const findReviewProjects = (userId: string) =>
  prisma.project.findMany({
    where: {
      members: { some: { userId, role: { in: ['OWNER', 'MANAGER'] } } },
    },
    select: { id: true, name: true, keyPrefix: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

export const findReviewItems = (
  userId: string,
  query: ReviewQuery,
  cursor: ReviewCursor | null,
) =>
  prisma.item.findMany({
    where: {
      deletedAt: null,
      state: { key: 'in_review' },
      project: {
        members: { some: { userId, role: { in: ['OWNER', 'MANAGER'] } } },
      },
      ...(query.projectId && { projectId: query.projectId }),
      ...(cursor && {
        OR: [
          { updatedAt: { lt: cursor.at } },
          { updatedAt: cursor.at, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    select: {
      id: true,
      number: true,
      title: true,
      kind: true,
      priority: true,
      updatedAt: true,
      project: { select: { id: true, name: true, keyPrefix: true } },
      state: { select: { id: true, name: true, key: true, category: true } },
      assignee: { select: { id: true, name: true, image: true } },
    },
  });
