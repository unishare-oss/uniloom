import { apiError } from '@/http.js';
import type { WorkspaceMode } from '@/generated/prisma/enums.js';
import {
  createWorkspace as insertWorkspace,
  findWorkspaceDetailForMember,
  findWorkspaceForMember,
  findWorkspacesForUser,
  isMember,
} from './workspace.repository.js';

/** Creates a workspace in a mode; the creator becomes its OWNER. */
export const createWorkspace = async (
  userId: string,
  input: { name: string; keyPrefix: string; mode: WorkspaceMode },
) => {
  const workspace = await insertWorkspace({ ...input, ownerId: userId });
  if (!workspace)
    throw apiError(
      409,
      'key_prefix_taken',
      `${input.keyPrefix} is already used`,
    );
  return workspace;
};

export const listWorkspaces = (userId: string) => {
  return findWorkspacesForUser(userId);
};

/** The workspace with its states in board order; 404 for non-members. */
export const getWorkspace = async (workspaceId: string, userId: string) => {
  const workspace = await findWorkspaceDetailForMember(workspaceId, userId);
  if (!workspace) throw apiError(404, 'not_found', 'Workspace not found');
  return workspace;
};

/** The workspace, or 404 when it doesn't exist or the user isn't a member. */
export const requireMember = async (workspaceId: string, userId: string) => {
  const workspace = await findWorkspaceForMember(workspaceId, userId);
  if (!workspace) throw apiError(404, 'not_found', 'Workspace not found');
  return workspace;
};

/** Whether `userId` belongs to the workspace, e.g. before assigning them an item. */
export const isWorkspaceMember = (workspaceId: string, userId: string) => {
  return isMember(workspaceId, userId);
};
