import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import type { Role } from '@/generated/prisma/enums.js';
import { apiError } from '@/http.js';

const withUser = { user: { select: { name: true, email: true, image: true } } };

export const findMembers = (projectId: string) => {
  return prisma.member.findMany({
    where: { projectId },
    include: withUser,
    orderBy: { createdAt: 'asc' },
  });
};

export const findMember = (projectId: string, userId: string) => {
  return prisma.member.findUnique({
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
 * Runs `change` with the project row locked, so two owners demoting or removing each
 * other at once can't both pass the check. 404 if the target isn't a member, 409
 * `last_owner` if the change (to `newRole`, or removal when null) would leave no owner.
 */
const keepingOwner = <T>(
  projectId: string,
  targetId: string,
  newRole: Role | null,
  change: (tx: Prisma.TransactionClient) => Promise<T>,
) => {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
    const target = await tx.member.findUnique({
      where: { projectId_userId: { projectId, userId: targetId } },
    });
    if (!target) throw apiError(404, 'not_found', 'Member not found');
    if (target.role === 'OWNER' && newRole !== 'OWNER') {
      const owners = await tx.member.count({
        where: { projectId, role: 'OWNER' },
      });
      if (owners <= 1)
        throw apiError(
          409,
          'last_owner',
          'A project needs at least one owner. Make another member an owner first.',
        );
    }
    return change(tx);
  });
};

export const updateRoleKeepingOwner = (
  projectId: string,
  targetId: string,
  role: Role,
) => {
  return keepingOwner(projectId, targetId, role, (tx) =>
    tx.member.update({
      where: { projectId_userId: { projectId, userId: targetId } },
      data: { role },
      include: withUser,
    }),
  );
};

export const deleteKeepingOwner = (projectId: string, targetId: string) => {
  return keepingOwner(projectId, targetId, null, (tx) =>
    tx.member.delete({
      where: { projectId_userId: { projectId, userId: targetId } },
    }),
  );
};
