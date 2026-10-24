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
import * as memberRepo from '@/modules/members/member.repository.js';
import {
  isProjectMember,
  requireMember,
} from '@/modules/projects/project.service.js';
import { recordReviewSubmission } from '@/modules/notifications/notification.service.js';
import * as itemRules from './item.rules.js';
import { toItem, toListRow } from './item.utils.js';
import { toRelated } from './item-document.utils.js';
import * as itemDocumentRepo from './item-document.repository.js';
import type {
  ActivityChange,
  GithubPullRequestLine,
  ItemAgent,
  ItemRow,
} from './item.types.js';
import { findLatestActivity, insertActivity } from './activity.repository.js';
import * as itemRepo from './item.repository.js';

/**
 * The item and the user's role. The same 404 whether it doesn't exist or they aren't in
 * its project, so a guessable key (TG-12 over MCP) can't reveal that it exists.
 */
export const loadItem = async (id: string, userId: string) => {
  const item = await itemRepo.findItem(id);
  const member = item && (await memberRepo.findMember(item.projectId, userId));
  if (!item || !member) throw apiError(404, 'not_found', 'Item not found');
  return { item, role: member.role };
};

/** The item's key as people read it: TG-12. */
const itemKey = (item: { project: { keyPrefix: string }; number: number }) =>
  `${item.project.keyPrefix}-${item.number}`;

/**
 * Checks a new parent: same project, not the item itself, and allowed for its kind.
 * Returns the parent, or null when there is none.
 */
const checkParent = async (
  projectId: string,
  mode: ProjectMode,
  kind: ItemKind,
  parentId: string | null,
  itemId?: string,
) => {
  const parent = parentId ? await itemRepo.findItem(parentId) : null;
  if (
    parentId &&
    (!parent || parent.projectId !== projectId || parentId === itemId)
  )
    throw apiError(
      400,
      'invalid_parent',
      'The parent must be another item in this project',
    );
  const error = itemRules.kindError(mode, kind, parent?.kind ?? null);
  if (error) throw apiError(400, 'invalid_kind', error);
  return parent;
};

/** The state, or 400 when it isn't one of the project's. */
const checkState = async (projectId: string, stateId: string) => {
  const state = await itemRepo.findState(stateId);
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

/** 400 when a label isn't one of the project's, 409 when two share a group. */
const checkLabels = async (projectId: string, labelIds: string[]) => {
  const labels = await itemRepo.findLabels(labelIds);
  if (
    labels.length !== labelIds.length ||
    labels.some((label) => label.projectId !== projectId)
  )
    throw apiError(
      400,
      'invalid_labels',
      'Every label must belong to this project',
    );
  const error = itemRules.labelGroupError(labels);
  if (error) throw apiError(409, 'label_group_conflict', error);
};

export const listProjectItems = async (projectId: string, userId: string) => {
  const { role } = await requireRole(projectId, userId, ROLES);
  return (await itemRepo.listItems(projectId)).map((row) =>
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
  agent?: ItemAgent,
) => {
  const { role } = await requireRole(projectId, userId, CREATORS);
  const project = await requireMember(projectId, userId);
  const parent = await checkParent(
    projectId,
    project.mode,
    input.kind,
    input.parentId ?? null,
  );
  if (input.stateId) await checkState(projectId, input.stateId);
  if (input.assigneeId) await checkAssignee(projectId, input.assigneeId);
  const stateId =
    input.stateId ?? (await itemRepo.findFirstState(projectId)).id;
  const row = await prisma.$transaction(async (tx) => {
    const created = await itemRepo.createItem(tx, {
      ...input,
      projectId,
      stateId,
      createdById: userId,
    });
    await insertActivity(tx, {
      userId,
      agent,
      projectId,
      itemId: created.id,
      action: 'item.create',
      detail: { parent: parent && itemKey(parent) },
    });
    return created;
  });
  return toItem(row, role, userId);
};

/** The item with the documents it shows: none in a Standard project. */
export const getItem = async (id: string, userId: string) => {
  const { item, role } = await loadItem(id, userId);
  if (itemRules.guidedOnlyError(item.project))
    return {
      ...toItem(item, role, userId),
      ticketDocumentKinds: [],
      related: [],
    };
  const parent = item.parentId ? await itemRepo.findItem(item.parentId) : null;
  const rows = await itemDocumentRepo.findItemDocuments(id, parent?.id ?? null);
  return {
    ...toItem(item, role, userId),
    ticketDocumentKinds: itemRules.ticketDocumentKindsFor(item.project),
    related: toRelated(rows, id, parent && itemKey(parent)),
  };
};

/**
 * The fields an update really changes, as the history records them: names for people and
 * parents, codes for enums, no values for the description (too long to keep).
 */
const listChanges = async (
  item: ItemRow,
  input: {
    title?: string;
    description?: string;
    parentId?: string | null;
    priority?: Priority;
    assigneeId?: string | null;
  },
  newParent: ItemRow | null,
) => {
  const changes: ActivityChange[] = [];
  if (input.title !== undefined && input.title !== item.title)
    changes.push({ field: 'title', from: item.title, to: input.title });
  if (input.description !== undefined && input.description !== item.description)
    changes.push({ field: 'description' });
  if (input.priority !== undefined && input.priority !== item.priority)
    changes.push({
      field: 'priority',
      from: item.priority,
      to: input.priority,
    });
  if (input.assigneeId !== undefined && input.assigneeId !== item.assigneeId) {
    const ids = [item.assigneeId, input.assigneeId].filter((x) => x !== null);
    const users = await itemRepo.findUserNames(ids);
    const nameOf = (userId: string | null) =>
      users.find((user) => user.id === userId)?.name ?? null;
    changes.push({
      field: 'assignee',
      from: nameOf(item.assigneeId),
      to: nameOf(input.assigneeId),
    });
  }
  if (input.parentId !== undefined && input.parentId !== item.parentId) {
    const oldParent = item.parentId && (await itemRepo.findItem(item.parentId));
    changes.push({
      field: 'parent',
      from: oldParent ? itemKey(oldParent) : null,
      to: newParent ? itemKey(newParent) : null,
    });
  }
  return changes;
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
    labelIds?: string[];
  },
  agent?: ItemAgent,
) => {
  const { item, role } = await loadItem(id, userId);
  if (input.assigneeId !== undefined && input.assigneeId !== item.assigneeId) {
    if (
      !itemRules.mayAssign(
        role,
        userId,
        item.assigneeId,
        input.assigneeId,
        item.project.selfClaimAllowed,
      )
    )
      throw apiError(
        403,
        'forbidden',
        item.project.selfClaimAllowed
          ? 'Members can only claim a free ticket or unclaim their own'
          : 'Members can only unclaim their own ticket: this project turned off self-claim',
      );
  }
  // Claiming and editing in one request is fine: what counts is who owns it afterwards.
  const editsSent = [
    input.title,
    input.description,
    input.parentId,
    input.priority,
    input.labelIds,
  ].some((value) => value !== undefined);
  const editMessage = itemRules.editError(
    item.project,
    role,
    userId,
    input.assigneeId === undefined ? item.assigneeId : input.assigneeId,
  );
  if (editsSent && editMessage) throw apiError(403, 'forbidden', editMessage);
  const newParent =
    input.parentId !== undefined
      ? await checkParent(
          item.projectId,
          item.project.mode,
          item.kind,
          input.parentId,
          id,
        )
      : null;
  if (input.assigneeId) await checkAssignee(item.projectId, input.assigneeId);
  const { labelIds: sentIds, ...fields } = input;
  const labelIds = sentIds && [...new Set(sentIds)];
  if (labelIds) await checkLabels(item.projectId, labelIds);
  const changes = await listChanges(item, fields, newParent);
  const row = await prisma.$transaction(async (tx) => {
    if (labelIds) {
      // Locked, so two edits can't mix their label sets.
      await itemRepo.lockItem(tx, id);
      await itemRepo.setLabels(tx, id, labelIds);
    }
    const updated = await itemRepo.updateItem(tx, id, fields);
    if (changes.length > 0)
      await insertActivity(tx, {
        userId,
        agent,
        projectId: item.projectId,
        itemId: id,
        action: 'item.update',
        detail: { changes },
      });
    return updated;
  });
  return toItem(row, role, userId);
};

/**
 * After a move: when the item finished (Done or Canceled) and its parent is an open
 * feature whose slices are all finished, moves the feature to Done too.
 */
const finishFeature = async (
  tx: Prisma.TransactionClient,
  item: NonNullable<Awaited<ReturnType<typeof itemRepo.findItemForMove>>>,
) => {
  const finished = ['DONE', 'CANCELED'].includes(item.state.category);
  if (finished && item.parentId) {
    // Locked, so two slices finishing at once each see the other as finished.
    await itemRepo.lockItem(tx, item.parentId);
    const parent = await itemRepo.findParent(tx, item.parentId);
    const open =
      parent?.state.category !== 'DONE' &&
      parent?.state.category !== 'CANCELED';
    if (
      parent?.kind === 'FEATURE' &&
      open &&
      itemRules.featureDone(await itemRepo.findChildren(tx, item.parentId))
    ) {
      const done = await itemRepo.findFirstDoneState(tx, item.projectId);
      // The feature's own checklist gates it too: with an unticked entry it stays open.
      const featureError = itemRules.checklistError(
        item.project,
        parent.kind,
        await itemRepo.findChecklist(tx, item.parentId),
        done,
      );
      if (!featureError)
        await itemRepo.updateItem(tx, item.parentId, { stateId: done.id });
    }
  }
};

/**
 * Moves an item to another state: who may move it, the Done role check, then the
 * checklist gate. A slice that finishes can finish its feature too.
 */
export const moveItem = async (
  id: string,
  userId: string,
  stateId: string,
  agent?: ItemAgent,
) => {
  const { item: initial } = await loadItem(id, userId);
  const target = await checkState(initial.projectId, stateId);
  const result = await prisma.$transaction(async (tx) => {
    await itemRepo.lockItem(tx, id);
    const item = await itemRepo.findItemForMove(tx, id);
    if (!item) throw apiError(404, 'not_found', 'Item not found');
    const { role } = await requireRole(item.projectId, userId, ROLES, tx);
    if (!itemRules.mayMove(role, userId, item.assigneeId, item.state.key))
      throw apiError(
        403,
        item.state.key === 'in_review' ? 'review_locked' : 'forbidden',
        item.state.key === 'in_review'
          ? 'Only owners and managers can move work after submission for review'
          : 'Members can only move tickets assigned to them: claim it first',
      );
    if (target.id === item.state.id) return { row: item, role };
    if (target.category === 'DONE' && !itemRules.mayMoveToDone(role))
      throw apiError(
        403,
        'forbidden',
        'Only owners and managers can move a ticket to Done',
      );
    const error = itemRules.checklistError(
      item.project,
      item.kind,
      await itemRepo.findChecklist(tx, id),
      target,
    );
    if (error) throw apiError(409, 'criteria_incomplete', error);
    const updated = await itemRepo.updateItem(tx, id, { stateId });
    await insertActivity(tx, {
      userId,
      agent,
      projectId: item.projectId,
      itemId: id,
      action: 'item.move',
      detail: { from: item.state.name, to: target.name },
    });
    if (target.key === 'in_review')
      await recordReviewSubmission(tx, {
        projectId: item.projectId,
        itemId: id,
        actorId: userId,
        fromStateId: item.stateId,
        toStateId: target.id,
        fromStateKey: item.state.key,
        toStateKey: target.key,
      });
    await finishFeature(tx, updated);
    return { row: updated, role };
  });
  return toItem(result.row, result.role, userId);
};

const GITHUB_AGENT = { clientId: 'github', clientName: 'GitHub' };

/**
 * Moves an item for GitHub, with no user: no role checks, but the checklist gate holds. Runs in
 * the caller's transaction, so a failed gate fails the whole GitHub delivery, which is retried.
 * False when a person moved it out of In Review since GitHub read it.
 */
export const moveItemBySystem = async (
  tx: Prisma.TransactionClient,
  itemId: string,
  targetStateId: string,
  github: { pullRequests: GithubPullRequestLine[]; checksAfterMerge: boolean },
) => {
  await itemRepo.lockItem(tx, itemId);
  const item = await itemRepo.findItemForMove(tx, itemId);
  if (!item) throw apiError(404, 'not_found', 'Item not found');
  if (item.state.key !== 'in_review') return false;
  const target = await itemRepo.findStateInTransaction(tx, targetStateId);
  const error = itemRules.checklistError(
    item.project,
    item.kind,
    await itemRepo.findChecklist(tx, itemId),
    target,
  );
  if (error) throw apiError(409, 'criteria_incomplete', error);
  const updated = await itemRepo.updateItem(tx, itemId, {
    stateId: targetStateId,
  });
  await insertActivity(tx, {
    userId: null,
    agent: GITHUB_AGENT,
    projectId: item.projectId,
    itemId,
    action: 'item.move',
    detail: {
      from: item.state.name,
      to: target.name,
      pullRequests: github.pullRequests,
      checksAfterMerge: github.checksAfterMerge,
    },
  });
  await finishFeature(tx, updated);
  return true;
};

/**
 * Records that GitHub did not move the item to Done, and why. Skipped when the item's newest row
 * already says the same, so later events for the same merge (labels, more suites) add no rows.
 */
export const recordDoneSkipped = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  itemId: string,
  pullRequests: GithubPullRequestLine[],
  reasons: string[],
) => {
  const latest = await findLatestActivity(tx, itemId);
  // jsonb reorders object keys, so compare the reasons and PR numbers, not the whole detail.
  const before = latest?.detail as {
    pullRequests?: GithubPullRequestLine[];
    reasons?: string[];
  } | null;
  if (
    latest?.action === 'github.done_skipped' &&
    JSON.stringify(before?.reasons) === JSON.stringify(reasons) &&
    JSON.stringify(before?.pullRequests?.map((line) => line.number)) ===
      JSON.stringify(pullRequests.map((line) => line.number))
  )
    return;
  await insertActivity(tx, {
    userId: null,
    agent: GITHUB_AGENT,
    projectId,
    itemId,
    action: 'github.done_skipped',
    detail: { pullRequests, reasons },
  });
};

/** Deletes an item. One with children can't be deleted: move or delete them first. */
export const removeItem = async (
  id: string,
  userId: string,
  agent?: ItemAgent,
) => {
  const { item } = await loadItem(id, userId);
  await requireRole(item.projectId, userId, CREATORS);
  if ((await itemRepo.countChildren(id)) > 0)
    throw apiError(409, 'has_children', 'Delete or move its child items first');
  await prisma.$transaction(async (tx) => {
    await itemRepo.deleteItem(tx, id);
    await insertActivity(tx, {
      userId,
      agent,
      projectId: item.projectId,
      itemId: id,
      action: 'item.delete',
      detail: {},
    });
  });
};

/** The project's trash, so a person can find what to restore. */
export const listProjectDeletedItems = async (
  projectId: string,
  userId: string,
) => {
  const { role } = await requireRole(projectId, userId, ROLES);
  return (await itemRepo.listDeletedItems(projectId)).map((row) => ({
    ...toListRow(row, role, userId),
    deletedAt: row.deletedAt,
  }));
};

/**
 * Brings a deleted item back with its key and fields (not its old blocked-by links). A
 * deleted parent must be restored first, so nothing points at a hidden item.
 */
export const restoreProjectItem = async (
  id: string,
  userId: string,
  agent?: ItemAgent,
) => {
  const item = await itemRepo.findDeletedItem(id);
  if (!item) throw apiError(404, 'not_found', 'Deleted item not found');
  const { role } = await requireRole(item.projectId, userId, CREATORS);
  if (item.parentId && !(await itemRepo.findItem(item.parentId)))
    throw apiError(409, 'parent_deleted', 'Restore its parent first');
  const row = await prisma.$transaction(async (tx) => {
    const restored = await itemRepo.restoreItem(tx, id);
    await insertActivity(tx, {
      userId,
      agent,
      projectId: item.projectId,
      itemId: id,
      action: 'item.restore',
      detail: {},
    });
    return restored;
  });
  return toItem(row, role, userId);
};
