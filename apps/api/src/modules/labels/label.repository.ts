import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import type { LabelColor } from '@/generated/prisma/enums.js';

/** null if the name is taken in the project (the unique index decides, so races are safe). */
const nameTaken = (error: unknown) => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
    return null;
  throw error;
};

export const findLabels = (projectId: string) => {
  return prisma.label.findMany({
    where: { projectId },
    orderBy: [{ group: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
  });
};

export const findLabel = (id: string) => {
  return prisma.label.findUnique({ where: { id } });
};

/** The new label, or null if the name is taken in the project. */
export const createLabel = (data: {
  projectId: string;
  name: string;
  color: LabelColor;
  group?: string | null;
}) => {
  return prisma.label.create({ data }).catch(nameTaken);
};

/** The changed label, or null if the new name is taken in the project. */
export const updateLabel = (
  id: string,
  data: { name?: string; color?: LabelColor; group?: string | null },
) => {
  return prisma.label.update({ where: { id }, data }).catch(nameTaken);
};

/** Deletes the label; the cascade removes it from every item. */
export const deleteLabel = (id: string) => {
  return prisma.label.delete({ where: { id } });
};
