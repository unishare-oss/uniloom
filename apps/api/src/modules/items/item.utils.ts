import type { Role } from '@/generated/prisma/enums.js';
import { mayMove } from './item.rules.js';
import type { EntryRow, ItemRow } from './item.types.js';

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
