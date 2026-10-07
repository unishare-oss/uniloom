import { z } from 'zod';
import { LabelColor } from '@/generated/prisma/enums.js';

const priority = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);

export const createItemSchema = z.object({
  kind: z.enum(['TASK', 'SUBTASK', 'FEATURE', 'SLICE']),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(50_000).optional(),
  parentId: z.uuid().nullish(),
  priority: priority.optional(),
  assigneeId: z.string().min(1).nullish(),
  stateId: z.uuid().optional(),
});

export const updateItemSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(50_000).optional(),
  parentId: z.uuid().nullable().optional(),
  priority: priority.optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  /** Replaces the item's labels; two of one group are refused. */
  labelIds: z.array(z.uuid()).max(50).optional(),
});

export const moveItemSchema = z.object({ stateId: z.uuid() });

export const addBlockerSchema = z.object({ blockerId: z.uuid() });

const kind = z.enum(['TASK', 'SUBTASK', 'FEATURE', 'SLICE']);

export const checklistEntrySchema = z.object({
  id: z.uuid(),
  text: z.string(),
  done: z.boolean(),
  /** Free text: a commit SHA, test name or link. */
  evidence: z.string().nullable(),
  /** 0-based place in the list. */
  position: z.number().int(),
});

export const addChecklistEntrySchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const updateChecklistEntrySchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  done: z.boolean().optional(),
  /** Empty or null clears it. */
  evidence: z.string().trim().max(500).nullable().optional(),
});

export const reorderChecklistSchema = z.object({ ids: z.array(z.uuid()) });

export const itemLabelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.enum(LabelColor),
});

export const itemSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  projectId: z.uuid(),
  kind,
  title: z.string(),
  description: z.string(),
  state: z.object({
    id: z.uuid(),
    name: z.string(),
    key: z.string().nullable(),
    category: z.enum(['BACKLOG', 'UNSTARTED', 'STARTED', 'DONE', 'CANCELED']),
  }),
  priority,
  assigneeId: z.string().nullable(),
  /** Whether the caller may move it: the web reads this and never repeats the rule. */
  canMove: z.boolean(),
  parentId: z.uuid().nullable(),
  createdById: z.string().nullable(),
  /** Ids of the items this one waits on. */
  blockedBy: z.array(z.uuid()),
  /** The done-when entries, in order. */
  checklist: z.array(checklistEntrySchema),
  /** The item's labels, by name. */
  labels: z.array(itemLabelSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const itemRowSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  kind,
  title: z.string(),
  state: z.object({ id: z.uuid(), name: z.string() }),
  priority,
  assigneeId: z.string().nullable(),
  canMove: z.boolean(),
  parentId: z.uuid().nullable(),
  labels: z.array(itemLabelSchema),
});

export const deletedItemRowSchema = itemRowSchema.extend({
  deletedAt: z.iso.datetime(),
});
