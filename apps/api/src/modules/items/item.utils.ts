import type { Role } from '@/generated/prisma/enums.js';
import { mayEdit, mayMove } from './item.rules.js';
import type { findActivity } from './activity.repository.js';
import type { Activity, EntryRow, ItemRow } from './item.types.js';

/** One checklist entry, as the API returns it. */
export const toEntry = (row: EntryRow) => {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    evidence: row.evidence,
    position: row.position,
  };
};

/** The item's labels, flattened from the join rows. */
const toLabels = (row: ItemRow) => row.labels.map((link) => link.label);

/** One item, as the API returns it. */
export const toItem = (row: ItemRow, role: Role, userId: string) => {
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
    canMove: mayMove(role, userId, row.assigneeId, row.state.key),
    canEdit: mayEdit(role, userId, row.assigneeId),
    parentId: row.parentId,
    createdById: row.createdById,
    blockedBy: row.blockedBy.map((link) => link.blockerId),
    checklist: row.checklist.map(toEntry),
    labels: toLabels(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/** A slim row for lists. */
export const toListRow = (row: ItemRow, role: Role, userId: string) => {
  return {
    id: row.id,
    key: `${row.project.keyPrefix}-${row.number}`,
    kind: row.kind,
    title: row.title,
    state: { id: row.state.id, name: row.state.name },
    priority: row.priority,
    assigneeId: row.assigneeId,
    canMove: mayMove(role, userId, row.assigneeId, row.state.key),
    parentId: row.parentId,
    labels: toLabels(row),
  };
};

/** The row of an item's history, as the API returns it. */
export const toActivity = (
  row: Awaited<ReturnType<typeof findActivity>>[number],
) => {
  return {
    id: row.id,
    action: row.action,
    detail: row.detail,
    by: { name: row.user?.name ?? null, image: row.user?.image ?? null },
    // An agent row has a client id even when the client sent no name.
    agent: row.clientId || row.agentName ? { name: row.agentName } : null,
    at: row.createdAt.toISOString(),
  } as Activity;
};
