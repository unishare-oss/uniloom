import { z } from 'zod';

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
  stateId: z.uuid().optional(),
});

export const addBlockerSchema = z.object({ blockerId: z.uuid() });

const kind = z.enum(['TASK', 'SUBTASK', 'FEATURE', 'SLICE']);

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
  parentId: z.uuid().nullable(),
  createdById: z.string().nullable(),
  /** Ids of the items this one waits on. */
  blockedBy: z.array(z.uuid()),
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
  parentId: z.uuid().nullable(),
});

export const deletedItemRowSchema = itemRowSchema.extend({
  deletedAt: z.iso.datetime(),
});
