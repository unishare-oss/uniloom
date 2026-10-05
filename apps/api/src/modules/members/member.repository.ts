import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import type { Role } from '@/generated/prisma/enums.js';

const withUser = { user: { select: { name: true, email: true, image: true } } };

export const findMembers = (projectId: string) => {
  return prisma.member.findMany({
    where: { projectId },
    include: withUser,
    orderBy: { createdAt: 'asc' },
  });
};

/** Pass `db` to read inside a transaction. */
export const findMember = (
  projectId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
) => {
  return db.member.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
};

export const findUserByEmail = (email: string) => {
  return prisma.user.findUnique({ where: { email } });
};

/** The new membership, or null if the user already belongs (the primary key decides). */
export const insertMember = (projectId: string, userId: string, role: Role) => {
  return prisma.member
    .create({ data: { projectId, userId, role }, include: withUser })
    .catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return null;
      throw error;
    });
};

/**
 * Locks the project row until the transaction ends, so two owners demoting or removing
 * each other at once run one at a time. Call it first, before counting owners.
 */
export const lockProject = (
  tx: Prisma.TransactionClient,
  projectId: string,
) => {
  return tx.$queryRaw`SELECT 1 FROM "project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
};

export const countOwners = (
  tx: Prisma.TransactionClient,
  projectId: string,
) => {
  return tx.member.count({ where: { projectId, role: 'OWNER' } });
};

export const updateRole = (
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
  role: Role,
) => {
  return tx.member.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
    include: withUser,
  });
};

export const deleteMember = (
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
) => {
  return tx.member.delete({
    where: { projectId_userId: { projectId, userId } },
  });
};
