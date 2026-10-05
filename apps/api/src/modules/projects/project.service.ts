import { apiError } from '@/http.js';
import type { ProjectMode } from '@/generated/prisma/enums.js';
import { requireRole } from '@/modules/members/member.service.js';
import {
  createProject as insertProject,
  findProjectDetailForMember,
  findProjectForMember,
  findProjectsForUser,
  isMember,
} from './project.repository.js';

/** Creates a project in a mode; the creator becomes its OWNER. */
export const createProject = async (
  userId: string,
  input: { name: string; keyPrefix: string; mode: ProjectMode },
) => {
  const project = await insertProject({ ...input, ownerId: userId });
  if (!project)
    throw apiError(
      409,
      'key_prefix_taken',
      `${input.keyPrefix} is already used`,
    );
  return project;
};

export const listProjects = (userId: string) => {
  return findProjectsForUser(userId);
};

/**
 * The project with its states in board order, plus the caller's role and whether they
 * may manage members; 404 for non-members.
 */
export const getProject = async (projectId: string, userId: string) => {
  const { role } = await requireRole(projectId, userId, [
    'OWNER',
    'REVIEWER',
    'MEMBER',
  ]);
  const project = await findProjectDetailForMember(projectId, userId);
  if (!project) throw apiError(404, 'not_found', 'Project not found');
  return { ...project, role, canManageMembers: role === 'OWNER' };
};

/** The project, or 404 when it doesn't exist or the user isn't a member. */
export const requireMember = async (projectId: string, userId: string) => {
  const project = await findProjectForMember(projectId, userId);
  if (!project) throw apiError(404, 'not_found', 'Project not found');
  return project;
};

/** Whether `userId` belongs to the project, e.g. before assigning them an item. */
export const isProjectMember = (projectId: string, userId: string) => {
  return isMember(projectId, userId);
};
