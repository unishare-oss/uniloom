import { prisma } from '@/db/prisma.js';
import type { DocumentKind } from '@/generated/prisma/enums.js';

const withAuthor = {
  author: { select: { id: true, name: true, image: true } },
};

/** Newest edit first, at most 200, archived ones only when asked. The body is not read. */
export const findDocuments = (
  projectId: string,
  filter: { kind?: DocumentKind; q?: string; archived: boolean },
) => {
  return prisma.document.findMany({
    where: {
      projectId,
      kind: filter.kind,
      ...(filter.q && {
        title: { contains: filter.q, mode: 'insensitive' as const },
      }),
      ...(!filter.archived && { archivedAt: null }),
    },
    omit: { body: true },
    include: withAuthor,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
};

export const findDocument = (id: string) => {
  return prisma.document.findUnique({ where: { id }, include: withAuthor });
};

export const insertDocument = (data: {
  projectId: string;
  authorId: string;
  kind: DocumentKind;
  title: string;
  purpose?: string;
  body?: string;
}) => {
  return prisma.document.create({ data, include: withAuthor });
};

export const updateDocument = (
  id: string,
  data: {
    title?: string;
    purpose?: string;
    body?: string;
    archivedAt?: Date | null;
  },
) => {
  return prisma.document.update({ where: { id }, data, include: withAuthor });
};
