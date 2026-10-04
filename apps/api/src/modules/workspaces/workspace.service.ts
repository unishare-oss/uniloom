import { apiError } from '@/http.js';
import type { WorkspaceMode } from '@/generated/prisma/enums.js';
import {
  createWorkspace as insertWorkspace,
  findWorkspaceByKeyPrefix,
  findWorkspaceForMember,
  findWorkspacesForUser,
  isMember,
} from './workspace.repository.js';

/** Creates a workspace in a mode; the creator becomes its OWNER. */
export async function createWorkspace(
  userId: string,
  input: { name: string; keyPrefix: string; mode: WorkspaceMode },
) {
  if (await findWorkspaceByKeyPrefix(input.keyPrefix))
    throw apiError(
      409,
      'key_prefix_taken',
      `${input.keyPrefix} is already used`,
    );
  return insertWorkspace({ ...input, ownerId: userId });
}

export function listWorkspaces(userId: string) {
  return findWorkspacesForUser(userId);
}

/** The workspace, or 404 when it doesn't exist or the user isn't a member. */
export async function requireMember(workspaceId: string, userId: string) {
  const workspace = await findWorkspaceForMember(workspaceId, userId);
  if (!workspace) throw apiError(404, 'not_found', 'Workspace not found');
  return workspace;
}

/** Whether `userId` belongs to the workspace, e.g. before assigning them an item. */
export function isWorkspaceMember(workspaceId: string, userId: string) {
  return isMember(workspaceId, userId);
}
