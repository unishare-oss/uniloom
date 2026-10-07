import { apiError } from '@/http.js';
import type { ProjectMode } from '@/generated/prisma/enums.js';
import {
  assignableRoles,
  CREATORS,
  requireRole,
  ROLES,
} from '@/modules/members/member.service.js';
import { mayMoveToDone } from '@/modules/items/item.rules.js';
import * as projectRepo from './project.repository.js';
import { limitsError } from './project.rules.js';

/** Creates a project in a mode; the creator becomes its OWNER. */
export const createProject = async (
  userId: string,
  input: { name: string; keyPrefix: string; mode: ProjectMode },
) => {
  const project = await projectRepo.createProject({
    ...input,
    ownerId: userId,
  });
  if (!project)
    throw apiError(
      409,
      'key_prefix_taken',
      `${input.keyPrefix} is already used`,
    );
  return project;
};

export const listProjects = (userId: string) => {
  return projectRepo.findProjectsForUser(userId);
};

/**
 * The project with its states in board order, plus the caller's role and what they
 * may do (manage members, create items, roles they can give); 404 for non-members.
 */
export const getProject = async (projectId: string, userId: string) => {
  const { role } = await requireRole(projectId, userId, ROLES);
  const project = await projectRepo.findProjectDetailForMember(
    projectId,
    userId,
  );
  if (!project) throw apiError(404, 'not_found', 'Project not found');
  return {
    ...project,
    role,
    canManageMembers: role === 'OWNER',
    canCreateItems: CREATORS.includes(role),
    canAssignOthers: CREATORS.includes(role),
    canEditSettings: role === 'OWNER',
    canCreateLabels: CREATORS.includes(role),
    canClaim: CREATORS.includes(role) || project.selfClaimAllowed,
    canMoveToDone: mayMoveToDone(role),
    assignableRoles: assignableRoles(role),
  };
};

/** The project, or 404 when it doesn't exist or the user isn't a member. */
export const requireMember = async (projectId: string, userId: string) => {
  const project = await projectRepo.findProjectForMember(projectId, userId);
  if (!project) throw apiError(404, 'not_found', 'Project not found');
  return project;
};

/** Whether `userId` belongs to the project, e.g. before assigning them an item. */
export const isProjectMember = (projectId: string, userId: string) => {
  return projectRepo.isMember(projectId, userId);
};

/**
 * Owner only: changes the name, switches and checklist limits. The body is merged with
 * the stored limits before checking them, so lowering the max below the stored min is
 * refused too. Existing checklists are not touched.
 */
export const updateProject = async (
  projectId: string,
  userId: string,
  input: {
    name?: string;
    checklistRequired?: boolean;
    checklistMin?: number | null;
    checklistMax?: number | null;
    designRequired?: boolean;
    approvalRequired?: boolean;
    approverNotAuthor?: boolean;
    plannedVsActual?: boolean;
    selfClaimAllowed?: boolean;
  },
) => {
  await requireRole(projectId, userId, ['OWNER']);
  const project = await requireMember(projectId, userId);
  const error = limitsError(
    input.checklistMin === undefined
      ? project.checklistMin
      : input.checklistMin,
    input.checklistMax === undefined
      ? project.checklistMax
      : input.checklistMax,
  );
  if (error) throw apiError(400, 'invalid_checklist_limits', error);
  const updated = await projectRepo.updateProject(projectId, input);
  if (!updated)
    throw apiError(
      400,
      'invalid_checklist_limits',
      'The limits changed while saving: reload and try again',
    );
  return updated;
};
