import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import * as itemRepo from '@/modules/items/item.repository.js';
import * as notificationRepo from '@/modules/notifications/notification.repository.js';
import {
  processNextReviewEvent,
  recordProcessingFailure,
  retryReviewEvent,
} from '@/modules/notifications/notification.service.js';
import { startTestApi, read } from './support/test-app.js';

let api: Awaited<ReturnType<typeof startTestApi>>;
const projectIds: string[] = [];

beforeAll(async () => {
  api = await startTestApi();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.item.updateMany({
    where: { projectId: { in: projectIds } },
    data: { parentId: null },
  });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  projectIds.length = 0;
});
afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${api.emailDomain}` } },
  });
  await api.close();
  await prisma.$disconnect();
});

const fixture = async () => {
  const owner = await api.signInReady();
  const manager = await api.signInReady();
  const member = await api.signInReady();
  const outsider = await api.signInReady();
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          owner.profile.email,
          manager.profile.email,
          member.profile.email,
          outsider.profile.email,
        ],
      },
    },
  });
  const ownerId = users.find((user) => user.email === owner.profile.email)!.id;
  const managerId = users.find(
    (user) => user.email === manager.profile.email,
  )!.id;
  const memberId = users.find(
    (user) => user.email === member.profile.email,
  )!.id;
  const project = await read(
    await api.send('POST', '/api/projects', owner.cookie, {
      name: 'Review tests',
      mode: 'GUIDED',
      keyPrefix: Array.from({ length: 5 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      ).join(''),
    }),
  );
  projectIds.push(project.id);
  await api.send('PATCH', `/api/projects/${project.id}`, owner.cookie, {
    checklistRequired: false,
  });
  await prisma.member.createMany({
    data: [
      { projectId: project.id, userId: managerId, role: 'MANAGER' },
      { projectId: project.id, userId: memberId, role: 'MEMBER' },
    ],
  });
  const feature = await read(
    await api.send('POST', `/api/projects/${project.id}/items`, owner.cookie, {
      kind: 'FEATURE',
      title: 'Feature',
    }),
  );
  const detail = await read(
    await api.send('GET', `/api/projects/${project.id}`, owner.cookie),
  );
  const ready = detail.states.find(
    (state: { key: string }) => state.key === 'ready',
  ).id;
  const review = detail.states.find(
    (state: { key: string }) => state.key === 'in_review',
  ).id;
  const progress = detail.states.find(
    (state: { key: string }) => state.key === 'in_progress',
  ).id;
  const done = detail.states.find(
    (state: { key: string }) => state.key === 'done',
  ).id;
  const item = await read(
    await api.send('POST', `/api/projects/${project.id}/items`, owner.cookie, {
      kind: 'SLICE',
      title: 'Review me',
      parentId: feature.id,
      assigneeId: memberId,
      stateId: ready,
    }),
  );
  return {
    owner,
    manager,
    member,
    outsider,
    ownerId,
    managerId,
    memberId,
    projectId: project.id,
    item,
    ready,
    review,
    progress,
    done,
  };
};

it('hands review authority to reviewers, restores member moves on return, and preserves each submission', async () => {
  const f = await fixture();
  expect(
    (
      await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
        stateId: f.review,
      })
    ).status,
  ).toBe(200);
  const first = await prisma.reviewEvent.findFirstOrThrow({
    where: { itemId: f.item.id },
  });
  expect(first.recipientIds.sort()).toEqual([f.ownerId, f.managerId].sort());
  expect(first.actorId).toBe(f.memberId);
  expect(first.processedAt).toBeNull();
  expect(
    (
      await read(
        await api.send('GET', `/api/items/${f.item.id}`, f.member.cookie),
      )
    ).canMove,
  ).toBe(false);
  const list = await read(
    await api.send(
      'GET',
      `/api/projects/${f.projectId}/items`,
      f.member.cookie,
    ),
  );
  expect(
    list.find((item: { id: string }) => item.id === f.item.id).canMove,
  ).toBe(false);
  expect(
    (
      await read(
        await api.send('GET', `/api/items/${f.item.id}`, f.manager.cookie),
      )
    ).canMove,
  ).toBe(true);
  const denied = await api.send(
    'POST',
    `/api/items/${f.item.id}/move`,
    f.member.cookie,
    { stateId: f.progress },
  );
  expect(denied.status).toBe(403);
  expect((await read(denied)).code).toBe('review_locked');
  expect(
    (
      await api.send('POST', `/api/items/${f.item.id}/move`, f.manager.cookie, {
        stateId: f.progress,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await read(
        await api.send('GET', `/api/items/${f.item.id}`, f.member.cookie),
      )
    ).canMove,
  ).toBe(true);
  expect(
    (
      await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
        stateId: f.review,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await api.send('POST', `/api/items/${f.item.id}/move`, f.owner.cookie, {
        stateId: f.review,
      })
    ).status,
  ).toBe(200);
  expect(await prisma.reviewEvent.count({ where: { itemId: f.item.id } })).toBe(
    2,
  );
  expect(
    (await prisma.reviewEvent.findUniqueOrThrow({ where: { id: first.id } }))
      .fromStateId,
  ).toBe(f.ready);
});

it('records exactly one event for concurrent submissions', async () => {
  const f = await fixture();
  const responses = await Promise.all([
    api.send('POST', `/api/items/${f.item.id}/move`, f.owner.cookie, {
      stateId: f.review,
    }),
    api.send('POST', `/api/items/${f.item.id}/move`, f.manager.cookie, {
      stateId: f.review,
    }),
  ]);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  expect(await prisma.reviewEvent.count({ where: { itemId: f.item.id } })).toBe(
    1,
  );
});

it('refuses a stale member request after another request submits for review', async () => {
  const f = await fixture();
  const loaded = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const original = itemRepo.findItem;
  vi.spyOn(itemRepo, 'findItem').mockImplementationOnce(async (id) => {
    const row = await original(id);
    loaded.resolve();
    await release.promise;
    return row;
  });
  const stale = api.send(
    'POST',
    `/api/items/${f.item.id}/move`,
    f.member.cookie,
    { stateId: f.progress },
  );
  await loaded.promise;
  try {
    expect(
      (
        await api.send('POST', `/api/items/${f.item.id}/move`, f.owner.cookie, {
          stateId: f.review,
        })
      ).status,
    ).toBe(200);
  } finally {
    release.resolve();
  }
  expect((await stale).status).toBe(403);
  expect(
    (await prisma.item.findUniqueOrThrow({ where: { id: f.item.id } })).stateId,
  ).toBe(f.review);
});

it('rolls the item move back if durable event storage fails', async () => {
  const f = await fixture();
  vi.spyOn(notificationRepo, 'insertReviewEvent').mockRejectedValueOnce(
    new Error('Injected event persistence failure'),
  );
  expect(
    (
      await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
        stateId: f.review,
      })
    ).status,
  ).toBe(500);
  expect(
    (await prisma.item.findUniqueOrThrow({ where: { id: f.item.id } })).stateId,
  ).toBe(f.ready);
  expect(await prisma.reviewEvent.count({ where: { itemId: f.item.id } })).toBe(
    0,
  );
});

it('fans out independently, skips revoked recipients, and safely handles duplicate rows', async () => {
  const f = await fixture();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  const event = await prisma.reviewEvent.findFirstOrThrow({
    where: { itemId: f.item.id },
  });
  await prisma.reviewEvent.update({
    where: { id: event.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await prisma.member.update({
    where: {
      projectId_userId: { projectId: f.projectId, userId: f.managerId },
    },
    data: { role: 'MEMBER' },
  });
  await prisma.notification.create({
    data: {
      eventId: event.id,
      recipientId: f.ownerId,
      projectId: f.projectId,
      itemId: f.item.id,
    },
  });
  expect(await processNextReviewEvent()).toBe(true);
  expect(
    await prisma.notification.count({ where: { eventId: event.id } }),
  ).toBe(1);
  expect(
    (await prisma.reviewEvent.findUniqueOrThrow({ where: { id: event.id } }))
      .processedAt,
  ).not.toBeNull();
  await recordProcessingFailure(event.id);
  expect(
    (await prisma.reviewEvent.findUniqueOrThrow({ where: { id: event.id } }))
      .attempts,
  ).toBe(0);
});

it('rolls partial fan-out back, retries with backoff, and allows recovery of exhausted events', async () => {
  const f = await fixture();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  const event = await prisma.reviewEvent.findFirstOrThrow({
    where: { itemId: f.item.id },
  });
  await prisma.reviewEvent.update({
    where: { id: event.id },
    data: { nextAttemptAt: new Date(0) },
  });
  vi.spyOn(notificationRepo, 'markEventProcessed').mockRejectedValueOnce(
    new Error('Injected interrupted transaction'),
  );
  await expect(processNextReviewEvent()).rejects.toThrow('Injected');
  expect(
    await prisma.notification.count({ where: { eventId: event.id } }),
  ).toBe(0);
  let pending = await prisma.reviewEvent.findUniqueOrThrow({
    where: { id: event.id },
  });
  expect(pending.attempts).toBe(1);
  expect(pending.processedAt).toBeNull();
  expect(pending.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  await prisma.reviewEvent.update({
    where: { id: event.id },
    data: { attempts: 9, nextAttemptAt: new Date(0) },
  });
  vi.spyOn(notificationRepo, 'insertNotifications').mockRejectedValueOnce(
    new Error('Injected final failure'),
  );
  await expect(processNextReviewEvent()).rejects.toThrow('Injected');
  pending = await prisma.reviewEvent.findUniqueOrThrow({
    where: { id: event.id },
  });
  expect(pending.failedAt).not.toBeNull();
  await retryReviewEvent(event.id);
  expect(await processNextReviewEvent()).toBe(true);
  expect(
    await prisma.notification.count({ where: { eventId: event.id } }),
  ).toBe(2);
});

it('does not notify about soft-deleted work', async () => {
  const f = await fixture();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  const event = await prisma.reviewEvent.findFirstOrThrow({
    where: { itemId: f.item.id },
  });
  await prisma.reviewEvent.update({
    where: { id: event.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await prisma.item.update({
    where: { id: f.item.id },
    data: { deletedAt: new Date() },
  });
  await processNextReviewEvent();
  expect(
    await prisma.notification.count({ where: { eventId: event.id } }),
  ).toBe(0);
});

it('keeps the live queue authoritative and paginated with reviewer-only visibility', async () => {
  const f = await fixture();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  const queue = await read(
    await api.send('GET', '/api/reviews', f.owner.cookie),
  );
  expect(
    queue.items.some((item: { id: string }) => item.id === f.item.id),
  ).toBe(true);
  expect(
    (await read(await api.send('GET', '/api/reviews', f.member.cookie))).items,
  ).toEqual([]);
  expect(
    (
      await api.send(
        'GET',
        `/api/reviews?projectId=${f.projectId}`,
        f.member.cookie,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await api.send(
        'GET',
        `/api/reviews?projectId=${f.projectId}`,
        f.outsider.cookie,
      )
    ).status,
  ).toBe(404);
  expect((await api.call('/api/reviews')).status).toBe(401);
  expect(
    (await api.send('GET', '/api/reviews?limit=0', f.owner.cookie)).status,
  ).toBe(400);
  expect(
    (await api.send('GET', '/api/reviews?cursor=bad', f.owner.cookie)).status,
  ).toBe(400);
  const second = await read(
    await api.send(
      'POST',
      `/api/projects/${f.projectId}/items`,
      f.owner.cookie,
      { kind: 'FEATURE', title: 'Second review', stateId: f.review },
    ),
  );
  const firstPage = await read(
    await api.send(
      'GET',
      `/api/reviews?projectId=${f.projectId}&limit=1`,
      f.owner.cookie,
    ),
  );
  expect(firstPage.items).toHaveLength(1);
  expect(firstPage.nextCursor).not.toBeNull();
  const nextPage = await read(
    await api.send(
      'GET',
      `/api/reviews?projectId=${f.projectId}&limit=1&cursor=${firstPage.nextCursor}`,
      f.owner.cookie,
    ),
  );
  expect(nextPage.items).toHaveLength(1);
  expect(new Set([firstPage.items[0].id, nextPage.items[0].id])).toEqual(
    new Set([second.id, f.item.id]),
  );
  await api.send('POST', `/api/items/${f.item.id}/move`, f.manager.cookie, {
    stateId: f.done,
  });
  expect(
    (
      await read(
        await api.send(
          'GET',
          `/api/reviews?projectId=${f.projectId}`,
          f.owner.cookie,
        ),
      )
    ).items.map((item: { id: string }) => item.id),
  ).not.toContain(f.item.id);
});

it('keeps per-user read state durable and only changes observed ids, including new arrivals', async () => {
  const f = await fixture();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  await prisma.reviewEvent.updateMany({
    where: { itemId: f.item.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await processNextReviewEvent();
  const initial = await read(
    await api.send(
      'GET',
      `/api/notifications/items/${f.item.id}`,
      f.owner.cookie,
    ),
  );
  const ownerId = initial.items[0].id;
  const managers = await read(
    await api.send(
      'GET',
      `/api/notifications/items/${f.item.id}`,
      f.manager.cookie,
    ),
  );
  const bad = await api.send(
    'POST',
    '/api/notifications/read',
    f.owner.cookie,
    { ids: [ownerId, managers.items[0].id] },
  );
  expect(bad.status).toBe(404);
  expect(
    (await prisma.notification.findUniqueOrThrow({ where: { id: ownerId } }))
      .readAt,
  ).toBeNull();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.manager.cookie, {
    stateId: f.progress,
  });
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  await prisma.reviewEvent.updateMany({
    where: { itemId: f.item.id, processedAt: null },
    data: { nextAttemptAt: new Date(0) },
  });
  await processNextReviewEvent();
  expect(
    (
      await api.send('POST', '/api/notifications/read', f.owner.cookie, {
        ids: [ownerId],
      })
    ).status,
  ).toBe(200);
  const history = await read(
    await api.send(
      'GET',
      `/api/notifications/items/${f.item.id}`,
      f.owner.cookie,
    ),
  );
  expect(history.items).toHaveLength(2);
  expect(history.items[0].readAt).toBeNull();
  expect(history.items[1].readAt).not.toBeNull();
  expect(
    (
      await prisma.notification.findUniqueOrThrow({
        where: { id: managers.items[0].id },
      })
    ).readAt,
  ).toBeNull();
  const readAt = history.items[1].readAt;
  await api.send('POST', '/api/notifications/read', f.owner.cookie, {
    ids: [ownerId],
  });
  expect(
    (
      await prisma.notification.findUniqueOrThrow({ where: { id: ownerId } })
    ).readAt!.toISOString(),
  ).toBe(readAt);
  const groups = await read(
    await api.send(
      'GET',
      `/api/notifications?projectId=${f.projectId}`,
      f.owner.cookie,
    ),
  );
  expect(groups.groups[0]).toMatchObject({
    totalCount: 2,
    unreadCount: 1,
    needsReview: true,
  });
  await api.send('POST', '/api/notifications/unread', f.owner.cookie, {
    ids: [ownerId],
  });
  expect(
    (
      await read(
        await api.send(
          'GET',
          `/api/notifications?projectId=${f.projectId}`,
          f.owner.cookie,
        ),
      )
    ).unreadCount,
  ).toBe(2);
  expect(
    (
      await api.send(
        'GET',
        `/api/notifications/items/${f.item.id}`,
        f.outsider.cookie,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await api.send('POST', '/api/notifications/read', f.outsider.cookie, {
        ids: [ownerId],
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await api.send('POST', '/api/notifications/read', f.owner.cookie, {
        ids: [randomUUID()],
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await api.send('POST', '/api/notifications/read', f.owner.cookie, {
        ids: [],
      })
    ).status,
  ).toBe(400);
});

it('paginates real submissions and groups, preserves completion history, and hides revoked or deleted content', async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) {
    await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
      stateId: f.review,
    });
    await prisma.reviewEvent.updateMany({
      where: { itemId: f.item.id, processedAt: null },
      data: { nextAttemptAt: new Date(0) },
    });
    await processNextReviewEvent();
    if (i < 2)
      await api.send('POST', `/api/items/${f.item.id}/move`, f.manager.cookie, {
        stateId: f.progress,
      });
  }
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: { id: string }[]; nextCursor: string | null } =
      await read(
        await api.send(
          'GET',
          `/api/notifications/items/${f.item.id}?limit=1${cursor ? `&cursor=${cursor}` : ''}`,
          f.owner.cookie,
        ),
      );
    seen.push(...page.items.map((item: { id: string }) => item.id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(new Set(seen).size).toBe(3);
  await api.send('POST', `/api/items/${f.item.id}/move`, f.owner.cookie, {
    stateId: f.done,
  });
  const history = await read(
    await api.send(
      'GET',
      `/api/notifications?projectId=${f.projectId}`,
      f.owner.cookie,
    ),
  );
  expect(history.groups[0]).toMatchObject({
    totalCount: 3,
    needsReview: false,
    item: { state: { key: 'done' } },
  });
  const other = await read(
    await api.send(
      'POST',
      `/api/projects/${f.projectId}/items`,
      f.owner.cookie,
      { kind: 'FEATURE', title: 'Other' },
    ),
  );
  await api.send('POST', `/api/items/${other.id}/move`, f.owner.cookie, {
    stateId: f.review,
  });
  await prisma.reviewEvent.updateMany({
    where: { itemId: other.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await processNextReviewEvent();
  const first = await read(
    await api.send(
      'GET',
      `/api/notifications?projectId=${f.projectId}&limit=1`,
      f.owner.cookie,
    ),
  );
  const next = await read(
    await api.send(
      'GET',
      `/api/notifications?projectId=${f.projectId}&limit=1&cursor=${first.nextCursor}`,
      f.owner.cookie,
    ),
  );
  expect(first.groups[0].item.id).not.toBe(next.groups[0].item.id);
  await prisma.item.update({
    where: { id: f.item.id },
    data: { deletedAt: new Date() },
  });
  const hidden = await read(
    await api.send(
      'GET',
      `/api/notifications?projectId=${f.projectId}`,
      f.owner.cookie,
    ),
  );
  expect(
    hidden.groups.find(
      (group: { item: { id: string } }) => group.item.id === f.item.id,
    ).item,
  ).toMatchObject({
    title: 'Unavailable item',
    key: null,
    available: false,
    state: null,
    assignee: null,
  });
  await prisma.member.update({
    where: {
      projectId_userId: { projectId: f.projectId, userId: f.managerId },
    },
    data: { role: 'MEMBER' },
  });
  expect(
    (await read(await api.send('GET', '/api/notifications', f.manager.cookie)))
      .groups,
  ).toEqual([]);
  expect(
    (
      await api.send(
        'GET',
        `/api/notifications/items/${f.item.id}`,
        f.manager.cookie,
      )
    ).status,
  ).toBe(404);
  await prisma.member.delete({
    where: {
      projectId_userId: { projectId: f.projectId, userId: f.managerId },
    },
  });
  expect(
    (
      await api.send(
        'GET',
        `/api/notifications?projectId=${f.projectId}`,
        f.manager.cookie,
      )
    ).status,
  ).toBe(404);
});

it('skips another worker’s lock and recovers an event after an interrupted transaction', async () => {
  const f = await fixture();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  const event = await prisma.reviewEvent.findFirstOrThrow({
    where: { itemId: f.item.id },
  });
  await prisma.reviewEvent.update({
    where: { id: event.id },
    data: { nextAttemptAt: new Date(0) },
  });
  let announce: () => void = () => undefined;
  let release: () => void = () => undefined;
  const locked = new Promise<void>((resolve) => {
    announce = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const interrupted = prisma
    .$transaction(
      async (tx) => {
        const claimed = await notificationRepo.findNextDueEvent(tx);
        expect(claimed?.id).toBe(event.id);
        announce();
        await released;
        throw new Error('simulated process interruption');
      },
      { timeout: 10_000 },
    )
    .catch((error: Error) => error.message);
  try {
    await locked;
    const secondClaim = await prisma.$transaction(async (tx) =>
      notificationRepo.findNextDueEvent(tx),
    );
    expect(secondClaim?.id).not.toBe(event.id);
  } finally {
    release();
  }
  expect(await interrupted).toBe('simulated process interruption');
  expect(
    (await prisma.reviewEvent.findUniqueOrThrow({ where: { id: event.id } }))
      .processedAt,
  ).toBeNull();
  expect(await processNextReviewEvent()).toBe(true);
  expect(
    await prisma.notification.count({ where: { eventId: event.id } }),
  ).toBe(2);
});

it('keeps submission history when its actor is deleted', async () => {
  const f = await fixture();
  await api.send('POST', `/api/items/${f.item.id}/move`, f.member.cookie, {
    stateId: f.review,
  });
  await prisma.reviewEvent.updateMany({
    where: { itemId: f.item.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await processNextReviewEvent();
  await prisma.user.delete({ where: { id: f.memberId } });
  const history = await read(
    await api.send(
      'GET',
      `/api/notifications/items/${f.item.id}`,
      f.owner.cookie,
    ),
  );
  expect(history.items).toHaveLength(1);
  expect(history.items[0].actor).toBeNull();
  expect(history.items[0].toStateKey).toBe('in_review');
});
