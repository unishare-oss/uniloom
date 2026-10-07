import { z } from 'zod';

export const reviewQuerySchema = z.object({
  projectId: z.uuid().optional(),
  cursor: z.string().min(1).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const reviewProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  keyPrefix: z.string(),
});
export const reviewItemSchema = z.object({
  id: z.uuid(),
  key: z.string().nullable(),
  title: z.string(),
  project: reviewProjectSchema,
  kind: z.enum(['TASK', 'SUBTASK', 'FEATURE', 'SLICE']).nullable(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).nullable(),
  state: z
    .object({
      id: z.uuid(),
      name: z.string(),
      key: z.string().nullable(),
      category: z.enum(['BACKLOG', 'UNSTARTED', 'STARTED', 'DONE', 'CANCELED']),
    })
    .nullable(),
  assignee: z
    .object({ id: z.string(), name: z.string(), image: z.string().nullable() })
    .nullable(),
  available: z.boolean(),
});
export const reviewPageSchema = z.object({
  items: z.array(reviewItemSchema),
  projects: z.array(reviewProjectSchema),
  nextCursor: z.string().nullable(),
});
