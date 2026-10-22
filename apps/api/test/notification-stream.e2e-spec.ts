import { prisma } from '@/db/prisma.js';
import { startNotificationListener } from '@/modules/notifications/notification.listener.js';
import { processNextReviewEvent } from '@/modules/notifications/notification.service.js';
import { startTestApi, read } from './support/test-app.js';

let api: Awaited<ReturnType<typeof startTestApi>>;
let stopListener: () => void;
const projectIds: string[] = [];
const closers: (() => Promise<void>)[] = [];

beforeAll(async () => {
  api = await startTestApi();
  stopListener = startNotificationListener();
});
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
  await prisma.item.updateMany({
    where: { projectId: { in: projectIds } },
    data: { parentId: null },
  });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  projectIds.length = 0;
});
afterAll(async () => {
  stopListener();
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${api.emailDomain}` } },
  });
  await api.close();
  await prisma.$disconnect();
});

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

/** Opens the stream like the browser does and keeps everything it receives. */
const openStream = async (cookie: string) => {
  const res = await api.call('/api/notifications/stream', { cookie });
  expect(res.status).toBe(200);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let received = '';
  const pump = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        received += decoder.decode(value);
      }
    } catch {
      // closed by the test
    }
  })();
  const stream = {
    res,
    text: () => received,
    /** Resolves once the text contains `needle`, or false after `ms`. */
    waitFor: async (needle: string, ms: number) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        if (received.includes(needle)) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return received.includes(needle);
    },
  };
  closers.push(async () => {
    await reader.cancel().catch(() => undefined);
    await pump;
  });
  return stream;
};

const userId = async (email: string) =>
  (await prisma.user.findFirstOrThrow({ where: { email } })).id;

describe('notification stream (e2e)', () => {
  it('needs a signed-in user', async () => {
    const res = await api.call('/api/notifications/stream');
    expect(res.status).toBe(401);
  });

  it('tells a mentioned person, and only them, with nothing but event names', async () => {
    const test = await api.signInReady();
    const psst = await api.signInReady();
    const project = await read(
      await api.send('POST', '/api/projects', test.cookie, {
        name: 'Stream',
        keyPrefix: freshPrefix(),
        mode: 'STANDARD',
      }),
    );
    projectIds.push(project.id);
    await api.send('POST', `/api/projects/${project.id}/members`, test.cookie, {
      email: psst.profile.email,
      role: 'MEMBER',
    });
    const item = await read(
      await api.send('POST', `/api/projects/${project.id}/items`, test.cookie, {
        kind: 'TASK',
        title: 'T',
      }),
    );
    const mine = await openStream(test.cookie);
    const theirs = await openStream(psst.cookie);
    expect(await theirs.waitFor('event: ready', 3_000)).toBe(true);
    expect(await mine.waitFor('event: ready', 3_000)).toBe(true);
    // The listener announces itself with a catch-up signal once connected; let that settle.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const before = theirs.text().split('event: changed').length - 1;
    const mineBefore = mine.text().split('event: changed').length - 1;

    const res = await api.send(
      'POST',
      `/api/items/${item.id}/comments`,
      test.cookie,
      { body: 'hi @psst', mentions: [await userId(psst.profile.email)] },
    );
    expect(res.status).toBe(201);

    const deadline = Date.now() + 3_000;
    while (
      Date.now() < deadline &&
      theirs.text().split('event: changed').length - 1 <= before
    )
      await new Promise((resolve) => setTimeout(resolve, 50));
    expect(theirs.text().split('event: changed').length - 1).toBe(before + 1);
    await new Promise((resolve) => setTimeout(resolve, 500));
    // The author's own stream got no signal from this comment.
    expect(mine.text().split('event: changed').length - 1).toBe(mineBefore);
    const mineAfter = mine.text();
    for (const line of [...mineAfter.split('\n'), ...theirs.text().split('\n')])
      expect(line).toMatch(/^(event: (ready|changed)|data: |: ping|)$/);
  });

  it('tells Owners when the worker fans out a review', async () => {
    const owner = await api.signInReady();
    const member = await api.signInReady();
    const project = await read(
      await api.send('POST', '/api/projects', owner.cookie, {
        name: 'Review stream',
        mode: 'GUIDED',
        keyPrefix: freshPrefix(),
      }),
    );
    projectIds.push(project.id);
    await api.send('PATCH', `/api/projects/${project.id}`, owner.cookie, {
      checklistRequired: false,
    });
    await prisma.member.create({
      data: {
        projectId: project.id,
        userId: await userId(member.profile.email),
        role: 'MEMBER',
      },
    });
    const feature = await read(
      await api.send(
        'POST',
        `/api/projects/${project.id}/items`,
        owner.cookie,
        {
          kind: 'FEATURE',
          title: 'Feature',
        },
      ),
    );
    const detail = await read(
      await api.send('GET', `/api/projects/${project.id}`, owner.cookie),
    );
    const stateId = (key: string) =>
      detail.states.find((state: { key: string }) => state.key === key).id;
    const item = await read(
      await api.send(
        'POST',
        `/api/projects/${project.id}/items`,
        owner.cookie,
        {
          kind: 'SLICE',
          title: 'Review me',
          parentId: feature.id,
          assigneeId: await userId(member.profile.email),
          stateId: stateId('ready'),
        },
      ),
    );
    const stream = await openStream(owner.cookie);
    expect(await stream.waitFor('event: ready', 3_000)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const before = stream.text().split('event: changed').length - 1;

    await api.send('POST', `/api/items/${item.id}/move`, member.cookie, {
      stateId: stateId('in_review'),
    });
    const event = await prisma.reviewEvent.findFirstOrThrow({
      where: { itemId: item.id },
    });
    await prisma.reviewEvent.update({
      where: { id: event.id },
      data: { nextAttemptAt: new Date(0) },
    });
    for (let tries = 0; tries < 50; tries++) {
      await processNextReviewEvent();
      const row = await prisma.reviewEvent.findUniqueOrThrow({
        where: { id: event.id },
      });
      if (row.processedAt) break;
    }
    const deadline = Date.now() + 3_000;
    while (
      Date.now() < deadline &&
      stream.text().split('event: changed').length - 1 <= before
    )
      await new Promise((resolve) => setTimeout(resolve, 50));
    expect(stream.text().split('event: changed').length - 1).toBeGreaterThan(
      before,
    );
  });

  it('holds no database connection per open stream', async () => {
    const person = await api.signInReady();
    const count = async () => {
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM pg_stat_activity WHERE usename = current_user`;
      return Number(rows[0].n);
    };
    await count();
    const before = await count();
    // One after another: opening them all at once makes the sign-in checks briefly use more pool connections.
    const streams = [];
    for (let i = 0; i < 20; i++) streams.push(await openStream(person.cookie));
    for (const stream of streams)
      expect(await stream.waitFor('event: ready', 3_000)).toBe(true);
    expect(await count()).toBe(before);
  });
});
