import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import type { Prisma } from '@/generated/prisma/client.js';
import type {
  ItemKind,
  Priority,
  ProjectMode,
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
  checklistError,
  featureDone,
  kindError,
  mayAssign,
  mayMove,
  mayMoveToDone,
  wouldCreateCycle,
} from './item.rules.js';
import { toEntry, toItem, toListRow } from './item.utils.js';
import {
  countChildren,
  createItem,
  deleteEntry,
  deleteItem,
  deleteLink,
  findChecklist,
  findChildren,
  findEntry,
  findFirstDoneState,
  findFirstState,
  findDeletedItem,
  findItem,
  findLinks,
  findParent,
  findState,
  insertEntry,
  insertLink,
  listDeletedItems,
  listItems,
  lockItem,
  lockProject,
  restoreItem,
  setEntryPosition,
  updateEntry,
  updateItem,
} from './item.repository.js';

// ---------------------------------------------------------------------------
// Rules

// ---------------------------------------------------------------------------
// Workflows

/** The item and the user's role, or 404 when it doesn't exist or they aren't in its project. */
const loadItem = async (id: string, userId: string) => {
  const item = await findItem(id);
  if (!item) throw apiError(404, 'not_found', 'Item not found');
  const { role } = await requireRole(item.projectId, userId, ROLES);
  return { item, role };
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

/** The state, or 400 when it isn't one of the project's. */
const checkState = async (projectId: string, stateId: string) => {
  const state = await findState(stateId);
  if (!state || state.projectId !== projectId)
    throw apiError(
      400,
      'invalid_state',
      'The state must belong to this project',
    );
  return state;
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
  const { role } = await requireRole(projectId, userId, ROLES);
  return (await listItems(projectId)).map((row) =>
    toListRow(row, role, userId),
  );
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
  const { role } = await requireRole(projectId, userId, CREATORS);
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
    role,
    userId,
  );
};

export const getItem = async (id: string, userId: string) => {
  const { item, role } = await loadItem(id, userId);
  return toItem(item, role, userId);
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
  },
) => {
  const { item, role } = await loadItem(id, userId);
  if (input.parentId !== undefined)
    await checkParent(
      item.projectId,
      item.project.mode,
      item.kind,
      input.parentId,
      id,
    );
  if (input.assigneeId !== undefined && input.assigneeId !== item.assigneeId) {
    if (!mayAssign(role, userId, item.assigneeId, input.assigneeId))
      throw apiError(
        403,
        'forbidden',
        'Members can only claim a free ticket or unclaim their own',
      );
  }
  if (input.assigneeId) await checkAssignee(item.projectId, input.assigneeId);
  const row = await prisma.$transaction((tx) => updateItem(tx, id, input));
  return toItem(row, role, userId);
};

/**
 * Moves an item to another state: who may move it, the Done role check, then the
 * checklist gate. A slice that finishes can finish its feature too.
 */
export const moveItem = async (id: string, userId: string, stateId: string) => {
  const { item, role } = await loadItem(id, userId);
  const target = await checkState(item.projectId, stateId);
  if (target.id === item.state.id) return toItem(item, role, userId);
  if (!mayMove(role, userId, item.assigneeId))
    throw apiError(
      403,
      'forbidden',
      'Members can only move tickets assigned to them: claim it first',
    );
  if (target.category === 'DONE' && !mayMoveToDone(role))
    throw apiError(
      403,
      'forbidden',
      'Only owners and managers can move a ticket to Done',
    );
  const row = await prisma.$transaction(async (tx) => {
    // Locked, so a tick or an added entry can't slip in between the check and the move.
    await lockItem(tx, id);
    const error = checklistError(
      item.project,
      item.kind,
      await findChecklist(tx, id),
      target,
    );
    if (error) throw apiError(409, 'criteria_incomplete', error);
    const updated = await updateItem(tx, id, { stateId });
    const finished = ['DONE', 'CANCELED'].includes(target.category);
    if (finished && item.parentId) {
      // Locked, so two slices finishing at once each see the other as finished.
      await lockItem(tx, item.parentId);
      const parent = await findParent(tx, item.parentId);
      const open =
        parent?.state.category !== 'DONE' &&
        parent?.state.category !== 'CANCELED';
      if (
        parent?.kind === 'FEATURE' &&
        open &&
        featureDone(await findChildren(tx, item.parentId))
      ) {
        const done = await findFirstDoneState(tx, item.projectId);
        // The feature's own checklist gates it too: with an unticked entry it stays open.
        const featureError = checklistError(
          item.project,
          parent.kind,
          await findChecklist(tx, item.parentId),
          done,
        );
        if (!featureError)
          await updateItem(tx, item.parentId, { stateId: done.id });
      }
    }
    return updated;
  });
  return toItem(row, role, userId);
};

/** Deletes an item. One with children can't be deleted: move or delete them first. */
export const removeItem = async (id: string, userId: string) => {
  const { item } = await loadItem(id, userId);
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
  const { role } = await requireRole(projectId, userId, ROLES);
  return (await listDeletedItems(projectId)).map((row) => ({
    ...toListRow(row, role, userId),
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
  const { role } = await requireRole(item.projectId, userId, CREATORS);
  if (item.parentId && !(await findItem(item.parentId)))
    throw apiError(409, 'parent_deleted', 'Restore its parent first');
  return toItem(await restoreItem(id), role, userId);
};

/** Records that the item waits on `blockerId`. */
export const addBlocker = async (
  id: string,
  userId: string,
  blockerId: string,
) => {
  const { item } = await loadItem(id, userId);
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

/**
 * Sets the entries' positions to 0..n-1 in the order of `ids`. Positions are unique per
 * item and Postgres checks that row by row, so it first moves every entry to a negative
 * position, then to its place.
 */
const writePositions = async (tx: Prisma.TransactionClient, ids: string[]) => {
  for (const [i, id] of ids.entries()) await setEntryPosition(tx, id, -i - 1);
  for (const [i, id] of ids.entries()) await setEntryPosition(tx, id, i);
};

/** Adds an entry at the end of the item's checklist. */
export const addChecklistEntry = async (
  itemId: string,
  userId: string,
  input: { text: string },
) => {
  const { item } = await loadItem(itemId, userId);
  // Locked, so two adds at once can't take the same position or both pass the limit.
  const entry = await prisma.$transaction(async (tx) => {
    await lockItem(tx, itemId);
    const entries = await findChecklist(tx, itemId);
    const max = item.project.checklistMax;
    if (max !== null && entries.length >= max)
      throw apiError(
        409,
        'checklist_max_exceeded',
        `A checklist holds at most ${max} entries: split this slice`,
      );
    return insertEntry(tx, itemId, input.text, entries.length);
  });
  return toEntry(entry);
};

/** Edits an entry's text, ticks or unticks it, sets its evidence. Unticking keeps it. */
export const updateChecklistEntry = async (
  itemId: string,
  entryId: string,
  userId: string,
  input: { text?: string; done?: boolean; evidence?: string | null },
) => {
  await loadItem(itemId, userId);
  // Locked, so a delete can't remove the entry between the check and the update.
  const entry = await prisma.$transaction(async (tx) => {
    await lockItem(tx, itemId);
    if (!(await findEntry(tx, itemId, entryId)))
      throw apiError(404, 'not_found', 'Checklist entry not found');
    return updateEntry(tx, entryId, {
      ...input,
      // Empty evidence clears it.
      evidence:
        input.evidence === undefined ? undefined : input.evidence || null,
    });
  });
  return toEntry(entry);
};

/** Deletes an entry and closes the gap, so positions stay 0..n-1. */
export const removeChecklistEntry = async (
  itemId: string,
  entryId: string,
  userId: string,
) => {
  await loadItem(itemId, userId);
  await prisma.$transaction(async (tx) => {
    await lockItem(tx, itemId);
    if (!(await findEntry(tx, itemId, entryId)))
      throw apiError(404, 'not_found', 'Checklist entry not found');
    await deleteEntry(tx, entryId);
    const rest = await findChecklist(tx, itemId);
    await writePositions(
      tx,
      rest.map((entry) => entry.id),
    );
  });
};

/** Sets the order. `ids` must be exactly the item's entries, once each. */
export const reorderChecklist = async (
  itemId: string,
  userId: string,
  ids: string[],
) => {
  await loadItem(itemId, userId);
  const entries = await prisma.$transaction(async (tx) => {
    await lockItem(tx, itemId);
    const current = await findChecklist(tx, itemId);
    if (
      ids.length !== current.length ||
      new Set(ids).size !== ids.length ||
      !current.every((entry) => ids.includes(entry.id))
    )
      throw apiError(
        400,
        'invalid_order',
        "ids must list every entry of the item's checklist, once each",
      );
    await writePositions(tx, ids);
    return findChecklist(tx, itemId);
  });
  return entries.map(toEntry);
};
