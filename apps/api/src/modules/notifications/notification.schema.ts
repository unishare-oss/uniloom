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
  /** How many of the unread ones are mentions. */
  mentionUnreadCount: z.number().int(),
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
      kind: z.enum(['REVIEW', 'MENTION']),
      /** Set on a REVIEW row. */
      eventId: z.uuid().nullable(),
      /** Set on a MENTION row: the comment that mentions the person. */
      commentId: z.uuid().nullable(),
      /** When it was submitted (REVIEW) or commented (MENTION). */
      at: z.iso.datetime(),
      readAt: z.iso.datetime().nullable(),
      fromStateKey: z.string().nullable(),
      toStateKey: z.string().nullable(),
      /** The submitter (REVIEW) or the comment's author (MENTION). */
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
