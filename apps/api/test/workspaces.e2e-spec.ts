import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

/** A key prefix no other test run uses: 5 random uppercase letters. */
const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

describe('workspaces (e2e)', () => {
  let api: Awaited<ReturnType<typeof startTestApi>>;

  beforeAll(async () => {
    api = await startTestApi();
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: {
        members: {
          some: { user: { email: { endsWith: `@${api.emailDomain}` } } },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${api.emailDomain}` } },
    });
    await prisma.$disconnect();
    await api?.close();
  });

  const create = (cookie: string, body: unknown) =>
    api.send('POST', '/api/workspaces', cookie, body);

  it('needs a session and consent', async () => {
    expect((await api.call('/api/workspaces')).status).toBe(401);
    const { cookie } = await api.signIn(api.newProfile());
    expect((await api.send('GET', '/api/workspaces', cookie)).status).toBe(403);
  });

  it('creates a Guided workspace with its 9 states and switches, owned by the creator', async () => {
    const { cookie, profile } = await api.signInReady();
    const res = await create(cookie, {
      name: 'Loom',
      keyPrefix: freshPrefix(),
      mode: 'GUIDED',
    });
    expect(res.status).toBe(201);
    const workspace = (await read(res)) as { id: string };

    const saved = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspace.id },
      include: {
        states: { orderBy: { position: 'asc' } },
        members: { include: { user: true } },
      },
    });
    expect(saved).toMatchObject({
      mode: 'GUIDED',
      checklistRequired: true,
      checklistMin: 3,
      checklistMax: 6,
      designRequired: true,
      approvalRequired: true,
      approverNotAuthor: true,
      plannedVsActual: true,
      nextItemNumber: 1,
    });
    expect(saved.states.map((s) => s.key)).toEqual([
      'triage',
      'backlog',
      'aligning',
      'ready',
      'in_progress',
      'blocked',
      'in_review',
      'done',
      'canceled',
    ]);
    expect(saved.members).toEqual([
      expect.objectContaining({
        role: 'OWNER',
        user: expect.objectContaining({ email: profile.email }),
      }),
    ]);
  });

  it('creates a Standard workspace with To Do, In Progress, Done and no switches', async () => {
    const { cookie } = await api.signInReady();
    const res = await create(cookie, {
      name: 'Tracker',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id } = (await read(res)) as { id: string };

    const saved = await prisma.workspace.findUniqueOrThrow({
      where: { id },
      include: { states: { orderBy: { position: 'asc' } } },
    });
    expect(saved).toMatchObject({
      checklistRequired: false,
      checklistMin: null,
      designRequired: false,
    });
    expect(saved.states.map((s) => [s.name, s.key, s.category])).toEqual([
      ['To Do', null, 'UNSTARTED'],
      ['In Progress', null, 'STARTED'],
      ['Done', null, 'DONE'],
    ]);
  });

  it('refuses a taken key prefix (409) and a malformed one (400)', async () => {
    const { cookie } = await api.signInReady();
    const keyPrefix = freshPrefix();
    expect(
      (await create(cookie, { name: 'A', keyPrefix, mode: 'STANDARD' })).status,
    ).toBe(201);

    const taken = await create(cookie, {
      name: 'B',
      keyPrefix,
      mode: 'STANDARD',
    });
    expect(taken.status).toBe(409);
    expect(await read(taken)).toMatchObject({ code: 'key_prefix_taken' });

    const bad = await create(cookie, {
      name: 'C',
      keyPrefix: 'ug1',
      mode: 'STANDARD',
    });
    expect(bad.status).toBe(400);
    expect(await read(bad)).toMatchObject({ code: 'invalid_input' });
  });

  it('lists only the workspaces the user belongs to', async () => {
    const mya = await api.signInReady();
    const kyaw = await api.signInReady();
    const name = `Mine-${randomUUID()}`;
    await create(mya.cookie, {
      name,
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });

    const mine = (await read(
      await api.send('GET', '/api/workspaces', mya.cookie),
    )) as { name: string }[];
    const theirs = (await read(
      await api.send('GET', '/api/workspaces', kyaw.cookie),
    )) as { name: string }[];
    expect(mine.map((w) => w.name)).toContain(name);
    expect(theirs.map((w) => w.name)).not.toContain(name);
  });
});
