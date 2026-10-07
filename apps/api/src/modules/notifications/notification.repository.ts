import type {
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
        include: { item: { select: { deletedAt: true } } },
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
      eventId: event.id,
      projectId: event.projectId,
      itemId: event.itemId,
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

const permittedProject = (userId: string) => ({
  members: {
    some: {
      userId,
      role: { in: ['OWNER', 'MANAGER'] as ('OWNER' | 'MANAGER')[] },
    },
  },
});

export const findNotificationGroups = (
  userId: string,
  query: NotificationQuery,
  cursor: ReviewCursor | null,
) => {
  return prisma.$queryRaw<NotificationGroupRow[]>(Prisma.sql`
    SELECT n."itemId", MAX(e."submittedAt") AS "latestSubmittedAt", COUNT(*) AS "totalCount",
      COUNT(*) FILTER (WHERE n."readAt" IS NULL) AS "unreadCount"
    FROM notification n JOIN review_event e ON e.id=n."eventId"
    JOIN member m ON m."projectId"=n."projectId" AND m."userId"=n."recipientId"
    WHERE n."recipientId"=${userId} AND m.role IN ('OWNER','MANAGER')
      ${query.projectId ? Prisma.sql`AND n."projectId"=${query.projectId}::uuid` : Prisma.empty}
    GROUP BY n."itemId"
    HAVING (NOT ${query.unreadOnly === 'true'} OR COUNT(*) FILTER (WHERE n."readAt" IS NULL)>0)
      ${cursor ? Prisma.sql`AND (MAX(e."submittedAt")<${cursor.at} OR (MAX(e."submittedAt")=${cursor.at} AND n."itemId"<${cursor.id}::uuid))` : Prisma.empty}
    ORDER BY MAX(e."submittedAt") DESC, n."itemId" DESC LIMIT ${query.limit + 1}`);
};

export const findNotificationItemViews = (userId: string, ids: string[]) =>
  prisma.item.findMany({
    where: { id: { in: ids }, project: permittedProject(userId) },
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
      recipientId: userId,
      readAt: null,
      project: permittedProject(userId),
      ...(projectId && { projectId }),
    },
  });

export const findItemNotificationAccess = (userId: string, itemId: string) =>
  prisma.notification.findFirst({
    where: { recipientId: userId, itemId, project: permittedProject(userId) },
    select: { id: true },
  });

export const findItemNotifications = (
  userId: string,
  itemId: string,
  limit: number,
  cursor: ReviewCursor | null,
) =>
  prisma.notification.findMany({
    where: {
      recipientId: userId,
      itemId,
      project: permittedProject(userId),
      ...(cursor && {
        OR: [
          { event: { submittedAt: { lt: cursor.at } } },
          { event: { submittedAt: cursor.at }, eventId: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ event: { submittedAt: 'desc' } }, { eventId: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      readAt: true,
      eventId: true,
      event: {
        select: {
          submittedAt: true,
          fromStateKey: true,
          toStateKey: true,
          actor: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });

/** Lock both the permitted records and their authority while the batch is changed. */
export const lockPermittedNotifications = (
  tx: Prisma.TransactionClient,
  userId: string,
  ids: string[],
) => tx.$queryRaw<{ id: string }[]>`
  SELECT n.id FROM notification n JOIN member m ON m."projectId"=n."projectId" AND m."userId"=n."recipientId"
  WHERE n.id=ANY(${ids}::uuid[]) AND n."recipientId"=${userId} AND m.role IN ('OWNER','MANAGER')
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
