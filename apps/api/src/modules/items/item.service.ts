import { apiError } from '@/http.js';
import type {
  ItemKind,
  Priority,
  WorkspaceMode,
} from '@/generated/prisma/enums.js';
import {
  isWorkspaceMember,
  requireMember,
} from '@/modules/workspaces/workspace.service.js';
import {
  countChildren,
  createItem,
  createLinkChecked,
  deleteItem,
  deleteLink,
  findFirstState,
  findDeletedItem,
  findItem,
  findState,
  listDeletedItems,
  listItems,
  restoreItem,
  updateItem,
} from './item.repository.js';

// ---------------------------------------------------------------------------
// Rules

/** For each kind a mode allows: the kinds its parent may have (null = no parent). */
const ALLOWED_PARENTS: Record<
  WorkspaceMode,
  Partial<Record<ItemKind, (ItemKind | null)[]>>
> = {
  // Two levels: a slice belongs to a feature.
  GUIDED: { FEATURE: [null], SLICE: ['FEATURE'] },
  // Three levels: an issue may sit in a project; a sub-issue belongs to an issue.
  STANDARD: { PROJECT: [null], ISSUE: [null, 'PROJECT'], SUB_ISSUE: ['ISSUE'] },
};

/** Why `kind` under `parentKind` isn't allowed in `mode`, or null when it is. */
export function kindError(
  mode: WorkspaceMode,
  kind: ItemKind,
  parentKind: ItemKind | null,
) {
  const parents = ALLOWED_PARENTS[mode][kind];
  if (!parents) return `${mode} workspaces have no ${kind} items`;
  if (!parents.includes(parentKind))
    return parentKind
      ? `a ${kind} can't be under a ${parentKind}`
      : `a ${kind} needs a parent (${parents.filter(Boolean).join(' or ')})`;
  return null;
}

/**
 * Whether adding "blocked waits on blocker" closes a loop: following the existing
 * "waits on" links from `blocker` reaches `blocked`.
 */
export function wouldCreateCycle(
  links: { blockedId: string; blockerId: string }[],
  blockedId: string,
  blockerId: string,
) {
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
}

// ---------------------------------------------------------------------------
// Views

type ItemRow = NonNullable<Awaited<ReturnType<typeof findItem>>>;

/** One item, as the API returns it. */
function toItem(row: ItemRow) {
  return {
    id: row.id,
    key: `${row.workspace.keyPrefix}-${row.number}`,
    workspaceId: row.workspaceId,
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
}

/** A slim row for lists. */
function toListRow(row: ItemRow) {
  return {
    id: row.id,
    key: `${row.workspace.keyPrefix}-${row.number}`,
    kind: row.kind,
    title: row.title,
    state: { id: row.state.id, name: row.state.name },
    priority: row.priority,
    assigneeId: row.assigneeId,
    parentId: row.parentId,
  };
}

// ---------------------------------------------------------------------------
// Workflows

/** The item, or 404 when it doesn't exist or the user isn't in its workspace. */
async function loadItem(id: string, userId: string) {
  const item = await findItem(id);
  if (!item) throw apiError(404, 'not_found', 'Item not found');
  await requireMember(item.workspaceId, userId);
  return item;
}

/** Checks a new parent: same workspace, not the item itself, and allowed for its kind. */
async function checkParent(
  workspaceId: string,
  mode: WorkspaceMode,
  kind: ItemKind,
  parentId: string | null,
  itemId?: string,
) {
  const parent = parentId ? await findItem(parentId) : null;
  if (
    parentId &&
    (!parent || parent.workspaceId !== workspaceId || parentId === itemId)
  )
    throw apiError(
      400,
      'invalid_parent',
      'The parent must be another item in this workspace',
    );
  const error = kindError(mode, kind, parent?.kind ?? null);
  if (error) throw apiError(400, 'invalid_kind', error);
}

async function checkState(workspaceId: string, stateId: string) {
  const state = await findState(stateId);
  if (!state || state.workspaceId !== workspaceId)
    throw apiError(
      400,
      'invalid_state',
      'The state must belong to this workspace',
    );
}

async function checkAssignee(workspaceId: string, assigneeId: string) {
  if (!(await isWorkspaceMember(workspaceId, assigneeId)))
    throw apiError(
      400,
      'invalid_assignee',
      'The assignee must be a member of this workspace',
    );
}

export async function listWorkspaceItems(workspaceId: string, userId: string) {
  await requireMember(workspaceId, userId);
  return (await listItems(workspaceId)).map(toListRow);
}

export async function createWorkspaceItem(
  workspaceId: string,
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
) {
  const workspace = await requireMember(workspaceId, userId);
  await checkParent(
    workspaceId,
    workspace.mode,
    input.kind,
    input.parentId ?? null,
  );
  if (input.stateId) await checkState(workspaceId, input.stateId);
  if (input.assigneeId) await checkAssignee(workspaceId, input.assigneeId);
  const stateId = input.stateId ?? (await findFirstState(workspaceId)).id;
  return toItem(
    await createItem({ ...input, workspaceId, stateId, createdById: userId }),
  );
}

export async function getItem(id: string, userId: string) {
  return toItem(await loadItem(id, userId));
}

export async function updateWorkspaceItem(
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
) {
  const item = await loadItem(id, userId);
  if (input.parentId !== undefined)
    await checkParent(
      item.workspaceId,
      item.workspace.mode,
      item.kind,
      input.parentId,
      id,
    );
  if (input.stateId) await checkState(item.workspaceId, input.stateId);
  if (input.assigneeId) await checkAssignee(item.workspaceId, input.assigneeId);
  return toItem(await updateItem(id, input));
}

/** Deletes an item. One with children can't be deleted: move or delete them first. */
export async function removeItem(id: string, userId: string) {
  await loadItem(id, userId);
  if ((await countChildren(id)) > 0)
    throw apiError(409, 'has_children', 'Delete or move its child items first');
  await deleteItem(id);
}

/** The workspace's trash, so a person can find what to restore. */
export async function listWorkspaceDeletedItems(
  workspaceId: string,
  userId: string,
) {
  await requireMember(workspaceId, userId);
  return (await listDeletedItems(workspaceId)).map((row) => ({
    ...toListRow(row),
    deletedAt: row.deletedAt,
  }));
}

/**
 * Brings a deleted item back with its key and fields (not its old blocked-by links). A
 * deleted parent must be restored first, so nothing points at a hidden item.
 */
export async function restoreWorkspaceItem(id: string, userId: string) {
  const item = await findDeletedItem(id);
  if (!item) throw apiError(404, 'not_found', 'Deleted item not found');
  await requireMember(item.workspaceId, userId);
  if (item.parentId && !(await findItem(item.parentId)))
    throw apiError(409, 'parent_deleted', 'Restore its parent first');
  return toItem(await restoreItem(id));
}

/** Records that the item waits on `blockerId`. */
export async function addBlocker(
  id: string,
  userId: string,
  blockerId: string,
) {
  const item = await loadItem(id, userId);
  if (blockerId === id)
    throw apiError(400, 'self_block', "An item can't wait on itself");
  const blocker = await findItem(blockerId);
  if (!blocker || blocker.workspaceId !== item.workspaceId)
    throw apiError(
      400,
      'invalid_blocker',
      'The blocker must be an item in this workspace',
    );
  await createLinkChecked(item.workspaceId, id, blockerId, (links) => {
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
  });
  return getItem(id, userId);
}

export async function removeBlocker(
  id: string,
  userId: string,
  blockerId: string,
) {
  await loadItem(id, userId);
  await deleteLink(id, blockerId);
}
