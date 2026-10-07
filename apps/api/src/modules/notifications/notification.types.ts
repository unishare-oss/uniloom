import type { ReviewQuery } from '@/modules/reviews/review.types.js';
export type NotificationQuery = ReviewQuery & { unreadOnly?: 'true' | 'false' };
export type NotificationGroupRow = {
  itemId: string;
  latestSubmittedAt: Date;
  totalCount: bigint;
  unreadCount: bigint;
};
