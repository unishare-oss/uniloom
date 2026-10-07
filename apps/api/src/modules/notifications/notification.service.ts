import type { NotificationQuery } from './notification.types.js';
import { listReviewProjects } from '@/modules/reviews/review.service.js';
import {
  decodeReviewCursor,
  reviewCursor,
} from '@/modules/reviews/review.utils.js';
import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import { retryDelay } from './notification.rules.js';
import type { Prisma } from '@/generated/prisma/client.js';
import * as notificationRepo from './notification.repository.js';

export const recordReviewSubmission = async (
  tx: Prisma.TransactionClient,
  input: {
    projectId: string;
    itemId: string;
    actorId: string;
    fromStateId: string;
    toStateId: string;
    fromStateKey: string | null;
    toStateKey: string;
  },
) => {
  const members = await notificationRepo.findReviewRecipients(
    tx,
    input.projectId,
  );
  return notificationRepo.insertReviewEvent(tx, {
    ...input,
    recipientIds: members.map((member) => member.userId),
  });
};

/** In-app fan-out only. No external delivery call belongs inside this transaction. */
export const processNextReviewEvent = async () => {
  let eventId: string | null = null;
  try {
    return await prisma.$transaction(async (tx) => {
      const event = await notificationRepo.findNextDueEvent(tx);
      if (!event) return false;
      eventId = event.id;
      if (!event.item.deletedAt) {
        const members = await notificationRepo.findEligibleRecipients(
          tx,
          event.projectId,
          event.recipientIds,
        );
        await notificationRepo.insertNotifications(
          tx,
          event,
          members.map((member) => member.userId),
        );
      }
      await notificationRepo.markEventProcessed(tx, event.id);
      return true;
    });
  } catch (error) {
    if (eventId) await recordProcessingFailure(eventId);
    throw error;
  }
};

export const recordProcessingFailure = async (id: string) => {
  return prisma.$transaction(async (tx) => {
    const event = await notificationRepo.lockReviewEvent(tx, id);
    if (!event || event.processedAt || event.failedAt) return;
    const attempts = event.attempts + 1;
    await notificationRepo.updateDelivery(tx, id, {
      attempts,
      nextAttemptAt: new Date(Date.now() + retryDelay(attempts)),
      failedAt: attempts >= 10 ? new Date() : null,
      lastError:
        'In-app notification processing failed; inspect worker health and retry after recovery',
    });
    console.error('Review notification processing failed', {
      eventId: id,
      attempts,
    });
  });
};

/** Operator-only command using the database credentials; no unauthenticated endpoint. */
export const retryReviewEvent = async (id: string) => {
  await prisma.$transaction(async (tx) => {
    const event = await notificationRepo.lockReviewEvent(tx, id);
    if (!event || !event.failedAt)
      throw apiError(404, 'not_found', 'Failed event not found');
    await notificationRepo.updateDelivery(tx, id, {
      attempts: 0,
      nextAttemptAt: new Date(),
      failedAt: null,
      lastError: null,
    });
  });
};

export const listNotificationGroups = async (
  userId: string,
  query: NotificationQuery,
) => {
  const projects = await listReviewProjects(userId, query.projectId);
  const rows = await notificationRepo.findNotificationGroups(
    userId,
    query,
    decodeReviewCursor(query.cursor),
  );
  const page = rows.slice(0, query.limit);
  const items = await notificationRepo.findNotificationItemViews(
    userId,
    page.map((row) => row.itemId),
  );
  const groups = page.flatMap((row) => {
    const item = items.find((item) => item.id === row.itemId);
    if (!item) return [];
    const available = !item.deletedAt;
    return [
      {
        item: {
          id: item.id,
          project: item.project,
          available,
          key: available ? `${item.project.keyPrefix}-${item.number}` : null,
          title: available ? item.title : 'Unavailable item',
          kind: available ? item.kind : null,
          priority: available ? item.priority : null,
          state: available ? item.state : null,
          assignee: available ? item.assignee : null,
        },
        latestSubmittedAt: row.latestSubmittedAt,
        totalCount: Number(row.totalCount),
        unreadCount: Number(row.unreadCount),
        needsReview: available && item.state.key === 'in_review',
      },
    ];
  });
  const last = page.at(-1);
  return {
    projects,
    groups,
    unreadCount: await notificationRepo.countUnreadNotifications(
      userId,
      query.projectId,
    ),
    nextCursor:
      rows.length > query.limit && last
        ? reviewCursor(last.latestSubmittedAt, last.itemId)
        : null,
  };
};

export const listItemNotifications = async (
  userId: string,
  itemId: string,
  query: { limit: number; cursor?: string },
) => {
  if (!(await notificationRepo.findItemNotificationAccess(userId, itemId)))
    throw apiError(404, 'not_found', 'Notifications not found');
  const rows = await notificationRepo.findItemNotifications(
    userId,
    itemId,
    query.limit,
    decodeReviewCursor(query.cursor),
  );
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      readAt: row.readAt,
      ...row.event,
    })),
    nextCursor:
      rows.length > query.limit && last
        ? reviewCursor(last.event.submittedAt, last.eventId)
        : null,
  };
};

export const setNotificationsRead = async (
  userId: string,
  ids: string[],
  read: boolean,
) => {
  const uniqueIds = [...new Set(ids)];
  await prisma.$transaction(async (tx) => {
    const rows = await notificationRepo.lockPermittedNotifications(
      tx,
      userId,
      uniqueIds,
    );
    if (rows.length !== uniqueIds.length)
      throw apiError(404, 'not_found', 'Notifications not found');
    await notificationRepo.updateReadState(tx, userId, uniqueIds, read);
  });
  return { ids: uniqueIds, read };
};
