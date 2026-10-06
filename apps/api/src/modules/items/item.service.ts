import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import type {
  ItemKind,
  Priority,
  ProjectMode,
  Role,
} from '@/generated/prisma/enums.js';
import {
  CREATORS,
  requireRole,
  ROLES,
} from '@/modules/members/member.service.js';
import {
  isProjectMember,
  requireMember,
} from '@/modules/projects/project.service.js';
import {
  countChildren,
  createItem,
  deleteItem,
  deleteLink,
  findFirstState,
  findDeletedItem,
  findItem,
  findLinks,
  findState,
  insertLink,
  listDeletedItems,
  listItems,
  lockProject,
  restoreItem,
  updateItem,
} from './item.repository.js';

// ---------------------------------------------------------------------------
// Rules

/** For each kind a mode allows: the kinds its parent may have (null = no parent). */
const ALLOWED_PARENTS: Record<
  ProjectMode,
  Partial<Record<ItemKind, (ItemKind | null)[]>>
> = {
  // Two levels: a slice belongs to a feature.
  GUIDED: { FEATURE: [null], SLICE: ['FEATURE'] },
  // Two levels: a subtask belongs to a task.
  STANDARD: { TASK: [null], SUBTASK: ['TASK'] },
};

/** Why `kind` under `parentKind` isn't allowed in `mode`, or null when it is. */
export const kindError = (
  mode: ProjectMode,
  kind: ItemKind,
  parentKind: ItemKind | null,
) => {
  const parents = ALLOWED_PARENTS[mode][kind];
  if (!parents) return `${mode} projects have no ${kind} items`;
  if (!parents.includes(parentKind))
    return parentKind
      ? `a ${kind} can't be under a ${parentKind}`
      : `a ${kind} needs a parent (${parents.filter(Boolean).join(' or ')})`;
  return null;
};

/**
 * Whether `role` may change a ticket's assignee from `from` to `to`. Owners and managers
 * may set anyone; a member may only claim a free ticket or unclaim their own.
 */
export const mayAssign = (
  role: Role,
  userId: string,
  from: string | null,
  to: string | null,
) => {
  if (CREATORS.includes(role)) return true;
  const claim = from === null && to === userId;
  const unclaim = from === userId && to === null;
  return claim || unclaim;
};

/**
 * Whether adding "blocked waits on blocker" closes a loop: following the existing
 * "waits on" links from `blocker` reaches `blocked`.
 */
export const wouldCreateCycle = (
  links: { blockedId: string; blockerId: string }[],
  blockedId: string,
  blockerId: string,
) => {
  const seen = new Set<string>();
  const queue = [blockerId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (current === blockedId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const link of links)
      if (link.blockedId === current) queue.push(link.blockerId);
  }
  return false;
};

// ---------------------------------------------------------------------------
// Views

type ItemRow = NonNullable<Awaited<ReturnType<typeof findItem>>>;

/** One item, as the API returns it. */
const toItem = (row: ItemRow) => {
  return {
    id: row.id,
    key: `${row.project.keyPrefix}-${row.number}`,
    projectId: row.projectId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    state: row.state,
    priority: row.priority,
    assigneeId: row.assigneeId,
    parentId: row.parentId,
    createdById: row.createdById,
    blockedBy: row.blockedBy.map((link) => link.blockerId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/** A slim row for lists. */
const toListRow = (row: ItemRow) => {
  return {
    id: row.id,
    key: `${row.project.keyPrefix}-${row.number}`,
    kind: row.kind,
    title: row.title,
    state: { id: row.state.id, name: row.state.name },
    priority: row.priority,
    assigneeId: row.assigneeId,
    parentId: row.parentId,
  };
};

// ---------------------------------------------------------------------------
// Workflows

/** The item, or 404 when it doesn't exist or the user isn't in its project. */
const loadItem = async (id: string, userId: string) => {
  const item = await findItem(id);
  if (!item) throw apiError(404, 'not_found', 'Item not found');
  await requireMember(item.projectId, userId);
  return item;
};

/** Checks a new parent: same project, not the item itself, and allowed for its kind. */
const checkParent = async (
  projectId: string,
  mode: ProjectMode,
  kind: ItemKind,
  parentId: string | null,
  itemId?: string,
) => {
  const parent = parentId ? await findItem(parentId) : null;
  if (
    parentId &&
    (!parent || parent.projectId !== projectId || parentId === itemId)
  )
    throw apiError(
      400,
      'invalid_parent',
      'The parent must be another item in this project',
    );
  const error = kindError(mode, kind, parent?.kind ?? null);
  if (error) throw apiError(400, 'invalid_kind', error);
};

const checkState = async (projectId: string, stateId: string) => {
  const state = await findState(stateId);
  if (!state || state.projectId !== projectId)
    throw apiError(
      400,
      'invalid_state',
      'The state must belong to this project',
    );
};

const checkAssignee = async (projectId: string, assigneeId: string) => {
  if (!(await isProjectMember(projectId, assigneeId)))
    throw apiError(
      400,
      'invalid_assignee',
      'The assignee must be a member of this project',
    );
};

export const listProjectItems = async (projectId: string, userId: string) => {
  await requireMember(projectId, userId);
  return (await listItems(projectId)).map(toListRow);
};

export const createProjectItem = async (
  projectId: string,
  userId: string,
  input: {
    kind: ItemKind;
    title: string;
    description?: string;
    parentId?: string | null;
    priority?: Priority;
    assigneeId?: string | null;
    stateId?: string;
  },
) => {
  await requireRole(projectId, userId, CREATORS);
  const project = await requireMember(projectId, userId);
  await checkParent(
    projectId,
    project.mode,
    input.kind,
    input.parentId ?? null,
  );
  if (input.stateId) await checkState(projectId, input.stateId);
  if (input.assigneeId) await checkAssignee(projectId, input.assigneeId);
  const stateId = input.stateId ?? (await findFirstState(projectId)).id;
  return toItem(
    await createItem({ ...input, projectId, stateId, createdById: userId }),
  );
};

export const getItem = async (id: string, userId: string) => {
  return toItem(await loadItem(id, userId));
};

export const updateProjectItem = async (
  id: string,
  userId: string,
  input: {
    title?: string;
    description?: string;
    parentId?: string | null;
    priority?: Priority;
    assigneeId?: string | null;
    stateId?: string;
  },
) => {
  const item = await loadItem(id, userId);
  if (input.parentId !== undefined)
    await checkParent(
      item.projectId,
      item.project.mode,
      item.kind,
      input.parentId,
      id,
    );
  if (input.stateId) await checkState(item.projectId, input.stateId);
  if (input.assigneeId !== undefined && input.assigneeId !== item.assigneeId) {
    const { role } = await requireRole(item.projectId, userId, ROLES);
    if (!mayAssign(role, userId, item.assigneeId, input.assigneeId))
      throw apiError(
        403,
        'forbidden',
        'Members can only claim a free ticket or unclaim their own',
      );
  }
  if (input.assigneeId) await checkAssignee(item.projectId, input.assigneeId);
  return toItem(await updateItem(id, input));
};

/** Deletes an item. One with children can't be deleted: move or delete them first. */
export const removeItem = async (id: string, userId: string) => {
  const item = await loadItem(id, userId);
  await requireRole(item.projectId, userId, CREATORS);
  if ((await countChildren(id)) > 0)
    throw apiError(409, 'has_children', 'Delete or move its child items first');
  await deleteItem(id);
};

/** The project's trash, so a person can find what to restore. */
export const listProjectDeletedItems = async (
  projectId: string,
  userId: string,
) => {
  await requireMember(projectId, userId);
  return (await listDeletedItems(projectId)).map((row) => ({
    ...toListRow(row),
    deletedAt: row.deletedAt,
  }));
};

/**
 * Brings a deleted item back with its key and fields (not its old blocked-by links). A
 * deleted parent must be restored first, so nothing points at a hidden item.
 */
export const restoreProjectItem = async (id: string, userId: string) => {
  const item = await findDeletedItem(id);
  if (!item) throw apiError(404, 'not_found', 'Deleted item not found');
  await requireRole(item.projectId, userId, CREATORS);
  if (item.parentId && !(await findItem(item.parentId)))
    throw apiError(409, 'parent_deleted', 'Restore its parent first');
  return toItem(await restoreItem(id));
};

/** Records that the item waits on `blockerId`. */
export const addBlocker = async (
  id: string,
  userId: string,
  blockerId: string,
) => {
  const item = await loadItem(id, userId);
  if (blockerId === id)
    throw apiError(400, 'self_block', "An item can't wait on itself");
  const blocker = await findItem(blockerId);
  if (!blocker || blocker.projectId !== item.projectId)
    throw apiError(
      400,
      'invalid_blocker',
      'The blocker must be an item in this project',
    );
  // Locked, so two adds at once can't both pass (A→B and B→A together are a loop).
  await prisma.$transaction(async (tx) => {
    await lockProject(tx, item.projectId);
    const links = await findLinks(tx, item.projectId);
    if (
      links.some(
        (link) => link.blockedId === id && link.blockerId === blockerId,
      )
    )
      throw apiError(409, 'already_blocked', 'It already waits on that item');
    if (wouldCreateCycle(links, id, blockerId))
      throw apiError(
        409,
        'blocking_cycle',
        'That would make the items wait on each other',
      );
    await insertLink(tx, id, blockerId);
  });
  return getItem(id, userId);
};

export const removeBlocker = async (
  id: string,
  userId: string,
  blockerId: string,
) => {
  await loadItem(id, userId);
  await deleteLink(id, blockerId);
};
