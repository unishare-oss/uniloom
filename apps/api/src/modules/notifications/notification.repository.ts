import type {
  ItemNotificationRow,
  NotificationQuery,
  NotificationGroupRow,
} from './notification.types.js';
import type { ReviewCursor } from '@/modules/reviews/review.types.js';
import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';

export const findReviewRecipients = (
  tx: Prisma.TransactionClient,
  projectId: string,
) => {
  return tx.member.findMany({
    where: { projectId, role: { in: ['OWNER', 'MANAGER'] } },
    select: { userId: true },
  });
};

export const insertReviewEvent = (
  tx: Prisma.TransactionClient,
  data: Prisma.ReviewEventUncheckedCreateInput,
) => {
  return tx.reviewEvent.create({ data });
};

export const findNextDueEvent = async (tx: Prisma.TransactionClient) => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM review_event WHERE "processedAt" IS NULL AND "failedAt" IS NULL
    AND "nextAttemptAt" <= now() ORDER BY "nextAttemptAt", id LIMIT 1 FOR UPDATE SKIP LOCKED`;
  return rows[0]
    ? tx.reviewEvent.findUnique({
        where: { id: rows[0].id },
        include: {
          item: { select: { deletedAt: true } },
          project: { select: { deletedAt: true } },
        },
      })
    : null;
};

export const findEligibleRecipients = (
  tx: Prisma.TransactionClient,
  projectId: string,
  recipientIds: string[],
) => {
  return tx.member.findMany({
    where: {
      projectId,
      userId: { in: recipientIds },
      role: { in: ['OWNER', 'MANAGER'] },
    },
    select: { userId: true },
  });
};

export const insertNotifications = (
  tx: Prisma.TransactionClient,
  event: { id: string; projectId: string; itemId: string },
  recipients: string[],
) => {
  return tx.notification.createMany({
    data: recipients.map((recipientId) => ({
      kind: 'REVIEW' as const,
      eventId: event.id,
      projectId: event.projectId,
      itemId: event.itemId,
      recipientId,
    })),
    skipDuplicates: true,
  });
};

export const insertMentionNotifications = (
  tx: Prisma.TransactionClient,
  comment: { projectId: string; itemId: string; commentId: string },
  recipientIds: string[],
) => {
  return tx.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      kind: 'MENTION' as const,
      commentId: comment.commentId,
      projectId: comment.projectId,
      itemId: comment.itemId,
      recipientId,
    })),
    skipDuplicates: true,
  });
};

export const markEventProcessed = (
  tx: Prisma.TransactionClient,
  id: string,
) => {
  return tx.reviewEvent.update({
    where: { id },
    data: { processedAt: new Date(), lastError: null },
  });
};

export const lockReviewEvent = async (
  tx: Prisma.TransactionClient,
  id: string,
) => {
  await tx.$queryRaw`SELECT id FROM review_event WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.reviewEvent.findUnique({ where: { id } });
};

export const updateDelivery = (
  tx: Prisma.TransactionClient,
  id: string,
  data: {
    attempts: number;
    nextAttemptAt: Date;
    failedAt: Date | null;
    lastError: string | null;
  },
) => tx.reviewEvent.update({ where: { id }, data });

const REVIEWERS = ['OWNER', 'MANAGER'] as ('OWNER' | 'MANAGER')[];

/**
 * The notifications this person may see: a REVIEW row needs an Owner or Manager seat, a
 * MENTION row any seat, and the project must be live.
 */
const visibleTo = (userId: string): Prisma.NotificationWhereInput => ({
  recipientId: userId,
  project: { deletedAt: null },
  OR: [
    { kind: 'MENTION', project: { members: { some: { userId } } } },
    {
      kind: 'REVIEW',
      project: { members: { some: { userId, role: { in: REVIEWERS } } } },
    },
  ],
});

/** The projects the inbox can show, for the filter: every live project the person is in. */
export const findInboxProjects = (userId: string) =>
  prisma.project.findMany({
    where: { deletedAt: null, members: { some: { userId } } },
    select: { id: true, name: true, keyPrefix: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

export const findNotificationGroups = (
  userId: string,
  query: NotificationQuery,
  cursor: ReviewCursor | null,
) => {
  return prisma.$queryRaw<NotificationGroupRow[]>(Prisma.sql`
    SELECT n."itemId", MAX(COALESCE(e."submittedAt", n."createdAt")) AS "latestSubmittedAt",
      COUNT(*) AS "totalCount",
      COUNT(*) FILTER (WHERE n."readAt" IS NULL) AS "unreadCount",
      COUNT(*) FILTER (WHERE n."readAt" IS NULL AND n.kind='MENTION') AS "mentionUnreadCount"
    FROM notification n LEFT JOIN review_event e ON e.id=n."eventId"
    JOIN member m ON m."projectId"=n."projectId" AND m."userId"=n."recipientId"
    JOIN project p ON p.id=n."projectId"
    WHERE n."recipientId"=${userId} AND (n.kind='MENTION' OR m.role IN ('OWNER','MANAGER'))
      AND p."deletedAt" IS NULL
      ${query.projectId ? Prisma.sql`AND n."projectId"=${query.projectId}::uuid` : Prisma.empty}
    GROUP BY n."itemId"
    HAVING (NOT ${query.unreadOnly === 'true'} OR COUNT(*) FILTER (WHERE n."readAt" IS NULL)>0)
      ${cursor ? Prisma.sql`AND (MAX(COALESCE(e."submittedAt", n."createdAt"))<${cursor.at} OR (MAX(COALESCE(e."submittedAt", n."createdAt"))=${cursor.at} AND n."itemId"<${cursor.id}::uuid))` : Prisma.empty}
    ORDER BY MAX(COALESCE(e."submittedAt", n."createdAt")) DESC, n."itemId" DESC LIMIT ${query.limit + 1}`);
};

export const findNotificationItemViews = (userId: string, ids: string[]) =>
  prisma.item.findMany({
    where: {
      id: { in: ids },
      project: { deletedAt: null, members: { some: { userId } } },
    },
    select: {
      id: true,
      number: true,
      title: true,
      deletedAt: true,
      kind: true,
      priority: true,
      project: { select: { id: true, name: true, keyPrefix: true } },
      state: { select: { id: true, name: true, key: true, category: true } },
      assignee: { select: { id: true, name: true, image: true } },
    },
  });

export const countUnreadNotifications = (userId: string, projectId?: string) =>
  prisma.notification.count({
    where: {
      ...visibleTo(userId),
      readAt: null,
      ...(projectId && { projectId }),
    },
  });

export const findItemNotificationAccess = (userId: string, itemId: string) =>
  prisma.notification.findFirst({
    where: { ...visibleTo(userId), itemId },
    select: { id: true },
  });

/** One item's notifications, newest first; `at` is the submission time, or the comment's. */
export const findItemNotifications = (
  userId: string,
  itemId: string,
  limit: number,
  cursor: ReviewCursor | null,
) =>
  prisma.$queryRaw<ItemNotificationRow[]>(Prisma.sql`
    SELECT n.id, n.kind, n."readAt", n."eventId", n."commentId",
      COALESCE(e."submittedAt", n."createdAt") AS "at",
      e."fromStateKey", e."toStateKey",
      u.id AS "actorId", u.name AS "actorName", u.image AS "actorImage"
    FROM notification n LEFT JOIN review_event e ON e.id=n."eventId"
    LEFT JOIN comment c ON c.id=n."commentId"
    LEFT JOIN "user" u ON u.id=COALESCE(e."actorId", c."authorId")
    JOIN member m ON m."projectId"=n."projectId" AND m."userId"=n."recipientId"
    JOIN project p ON p.id=n."projectId"
    WHERE n."recipientId"=${userId} AND n."itemId"=${itemId}::uuid
      AND (n.kind='MENTION' OR m.role IN ('OWNER','MANAGER')) AND p."deletedAt" IS NULL
      ${cursor ? Prisma.sql`AND (COALESCE(e."submittedAt", n."createdAt")<${cursor.at} OR (COALESCE(e."submittedAt", n."createdAt")=${cursor.at} AND n.id<${cursor.id}::uuid))` : Prisma.empty}
    ORDER BY COALESCE(e."submittedAt", n."createdAt") DESC, n.id DESC LIMIT ${limit + 1}`);

/** Lock both the permitted records and their authority while the batch is changed. */
export const lockPermittedNotifications = (
  tx: Prisma.TransactionClient,
  userId: string,
  ids: string[],
) => tx.$queryRaw<{ id: string }[]>`
  SELECT n.id FROM notification n JOIN member m ON m."projectId"=n."projectId" AND m."userId"=n."recipientId"
  JOIN project p ON p.id=n."projectId"
  WHERE n.id=ANY(${ids}::uuid[]) AND n."recipientId"=${userId}
  AND (n.kind='MENTION' OR m.role IN ('OWNER','MANAGER'))
  AND p."deletedAt" IS NULL
  FOR UPDATE OF n FOR SHARE OF m`;

export const updateReadState = (
  tx: Prisma.TransactionClient,
  userId: string,
  ids: string[],
  read: boolean,
) =>
  tx.notification.updateMany({
    where: {
      recipientId: userId,
      id: { in: ids },
      ...(read && { readAt: null }),
    },
    data: { readAt: read ? new Date() : null },
  });
