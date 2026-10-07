import { apiError } from '@/http.js';
import type { LabelColor } from '@/generated/prisma/enums.js';
import {
  CREATORS,
  requireRole,
  ROLES,
} from '@/modules/members/member.service.js';
import * as labelRepo from './label.repository.js';
import { toLabel } from './label.utils.js';

const nameTaken = (name: string) =>
  apiError(
    409,
    'label_name_taken',
    `The project already has a label named "${name}"`,
  );

/** The label, or 404 when it doesn't exist. */
const loadLabel = async (id: string) => {
  const label = await labelRepo.findLabel(id);
  if (!label) throw apiError(404, 'not_found', 'Label not found');
  return label;
};

/** Every label of the project, grouped ones first. Any member may ask. */
export const listLabels = async (projectId: string, userId: string) => {
  await requireRole(projectId, userId, ROLES);
  const labels = await labelRepo.findLabels(projectId);
  return labels.map(toLabel);
};

/** Owners and managers; putting the label in a group is the owner's call. */
export const createLabel = async (
  projectId: string,
  userId: string,
  input: { name: string; color: LabelColor; group?: string | null },
) => {
  await requireRole(projectId, userId, input.group ? ['OWNER'] : CREATORS);
  const label = await labelRepo.createLabel({ projectId, ...input });
  if (!label) throw nameTaken(input.name);
  return toLabel(label);
};

/**
 * Owners and managers change name and colour. A change of group is the owner's, since it
 * touches existing items; sending the group it already has changes nothing.
 */
export const updateLabel = async (
  id: string,
  userId: string,
  input: { name?: string; color?: LabelColor; group?: string | null },
) => {
  const label = await loadLabel(id);
  const regroups = input.group !== undefined && input.group !== label.group;
  await requireRole(label.projectId, userId, regroups ? ['OWNER'] : CREATORS);
  const updated = await labelRepo.updateLabel(id, input);
  if (!updated) throw nameTaken(input.name ?? label.name);
  return toLabel(updated);
};

/** Owner only. The label leaves every item that has it. */
export const removeLabel = async (id: string, userId: string) => {
  const label = await loadLabel(id);
  await requireRole(label.projectId, userId, ['OWNER']);
  await labelRepo.deleteLabel(id);
};
