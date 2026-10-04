import { prisma } from '@/db/prisma.js';
import type { WorkspaceMode } from '@/generated/prisma/enums.js';
import { PRESETS } from './workspace.presets.js';

/** The workspace, its mode's switches and states, and the creator as OWNER, together. */
export function createWorkspace(data: {
  name: string;
  keyPrefix: string;
  mode: WorkspaceMode;
  ownerId: string;
}) {
  const preset = PRESETS[data.mode];
  return prisma.workspace.create({
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
  });
}

export function findWorkspaceByKeyPrefix(keyPrefix: string) {
  return prisma.workspace.findUnique({ where: { keyPrefix } });
}

export function findWorkspacesForUser(userId: string) {
  return prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: 'asc' },
  });
}

/** The workspace, if `userId` is one of its members. */
export function findWorkspaceForMember(workspaceId: string, userId: string) {
  return prisma.workspace.findFirst({
    where: { id: workspaceId, members: { some: { userId } } },
  });
}

export function isMember(workspaceId: string, userId: string) {
  return prisma.member
    .count({ where: { workspaceId, userId } })
    .then((count) => count > 0);
}
