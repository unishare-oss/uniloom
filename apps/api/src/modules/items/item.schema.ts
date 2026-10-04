import { z } from 'zod';

const priority = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);

export const createItemSchema = z.object({
  kind: z.enum(['PROJECT', 'ISSUE', 'SUB_ISSUE', 'FEATURE', 'SLICE']),
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
