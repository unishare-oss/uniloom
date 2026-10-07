import { z } from 'zod';
import {
  reviewQuerySchema,
  reviewItemSchema,
  reviewProjectSchema,
} from '@/modules/reviews/review.schema.js';

export const notificationQuerySchema = reviewQuerySchema.extend({
  unreadOnly: z.enum(['true', 'false']).optional(),
});
export const historyQuerySchema = reviewQuerySchema.omit({ projectId: true });
export const notificationReadSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
});
export const notificationReadResultSchema = notificationReadSchema.extend({
  read: z.boolean(),
});
export const notificationGroupSchema = z.object({
  item: reviewItemSchema,
  latestSubmittedAt: z.iso.datetime(),
  totalCount: z.number().int(),
  unreadCount: z.number().int(),
  needsReview: z.boolean(),
});
export const notificationPageSchema = z.object({
  groups: z.array(notificationGroupSchema),
  projects: z.array(reviewProjectSchema),
  unreadCount: z.number().int(),
  nextCursor: z.string().nullable(),
});
export const notificationHistorySchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      eventId: z.uuid(),
      submittedAt: z.iso.datetime(),
      readAt: z.iso.datetime().nullable(),
      fromStateKey: z.string().nullable(),
      toStateKey: z.string(),
      actor: z
        .object({
          id: z.string(),
          name: z.string(),
          image: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
