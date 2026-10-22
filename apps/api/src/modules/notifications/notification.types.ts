import type { ReviewQuery } from '@/modules/reviews/review.types.js';
export type NotificationQuery = ReviewQuery & { unreadOnly?: 'true' | 'false' };
export type NotificationGroupRow = {
  itemId: string;
  latestSubmittedAt: Date;
  totalCount: bigint;
  unreadCount: bigint;
  mentionUnreadCount: bigint;
};
export type ItemNotificationRow = {
  id: string;
  kind: 'REVIEW' | 'MENTION';
  readAt: Date | null;
  eventId: string | null;
  commentId: string | null;
  at: Date;
  fromStateKey: string | null;
  toStateKey: string | null;
  actorId: string | null;
  actorName: string | null;
  actorImage: string | null;
};
