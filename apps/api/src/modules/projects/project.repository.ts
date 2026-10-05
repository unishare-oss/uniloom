import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import type { ProjectMode } from '@/generated/prisma/enums.js';
import { PRESETS } from './project.presets.js';

/**
 * The project, its mode's switches and states, and the creator as OWNER, together. null
 * if the key prefix is taken (the unique index decides, so concurrent creates are safe).
 */
export const createProject = async (data: {
  name: string;
  keyPrefix: string;
  mode: ProjectMode;
  ownerId: string;
}) => {
  const preset = PRESETS[data.mode];
  return prisma.project
    .create({
      data: {
        name: data.name,
        keyPrefix: data.keyPrefix,
        mode: data.mode,
        ...preset.switches,
        states: {
          create: preset.states.map((state, position) => ({
            ...state,
            position,
          })),
        },
        members: { create: { userId: data.ownerId, role: 'OWNER' } },
      },
    })
    .catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return null;
      throw error;
    });
};

export const findProjectsForUser = (userId: string) => {
  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: 'asc' },
  });
};

/** The project, if `userId` is one of its members. */
export const findProjectForMember = (projectId: string, userId: string) => {
  return prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
  });
};

export const isMember = (projectId: string, userId: string) => {
  return prisma.member
    .count({ where: { projectId, userId } })
    .then((count) => count > 0);
};

/** The project with its states in board order, if `userId` is one of its members. */
export const findProjectDetailForMember = (
  projectId: string,
  userId: string,
) => {
  return prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    include: {
      states: {
        select: {
          id: true,
          name: true,
          key: true,
          category: true,
          position: true,
        },
        orderBy: { position: 'asc' },
      },
    },
  });
};
