import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Debt {
  id: string;
  kind: string;
  number: number | null;
  status: string | null;
  fixedBy: { id: string; key: string } | null;
  createdFrom: { key: string } | null;
  homeItemId: string | null;
  items: { key: string }[];
  canEdit: boolean;
  canArchive: boolean;
  body: string;
  code?: string;
  message?: string;
}

describe('Tech debt (e2e)', () => {
  let api: Awaited<ReturnType<typeof startTestApi>>;

  beforeAll(async () => {
    api = await startTestApi();
  });

  afterAll(async () => {
    const projects = {
      members: {
        some: { user: { email: { endsWith: `@${api.emailDomain}` } } },
      },
    };
    await prisma.item.updateMany({
      where: { project: projects },
      data: { parentId: null },
    });
    await prisma.project.deleteMany({ where: projects });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${api.emailDomain}` } },
    });
    await prisma.$disconnect();
    await api?.close();
  });

  /** A project in `mode` with an owner, a member and an outsider. */
  const setup = async (mode: 'GUIDED' | 'STANDARD' = 'GUIDED') => {
    const owner = await api.signInReady();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'A',
      keyPrefix: freshPrefix(),
      mode,
    });
    const { id } = (await read(created)) as { id: string };
    const m = await api.signInReady();
    await api.send('POST', `/api/projects/${id}/members`, owner.cookie, {
      email: m.profile.email,
      role: 'MEMBER',
    });
    const user = await prisma.user.findFirstOrThrow({
      where: { email: m.profile.email },
    });
    const outsider = (await api.signInReady()).cookie;
    const feature = async (extra: Record<string, unknown> = {}) =>
      (await read(
        await api.send('POST', `/api/projects/${id}/items`, owner.cookie, {
          kind: mode === 'GUIDED' ? 'FEATURE' : 'TASK',
          title: 'Ticket',
          ...extra,
        }),
      )) as { id: string; key: string };
    return {
      id,
      owner: owner.cookie,
      member: { cookie: m.cookie, id: user.id },
      outsider,
      feature,
    };
  };

  const raise = (cookie: string, itemId: string, title = 'Slow query') =>
    api.send('POST', `/api/items/${itemId}/documents/new`, cookie, {
      kind: 'TECH_DEBT',
      title,
      body: 'What and why',
    });
  const status = (
    cookie: string,
    docId: string,
    body: Record<string, unknown>,
  ) => api.send('POST', `/api/documents/${docId}/status`, cookie, body);
  /** Moves the ticket straight into the project's Done state. */
  const finish = async (projectId: string, itemId: string) => {
    const done = await prisma.state.findFirstOrThrow({
      where: { projectId, key: 'done' },
    });
    await prisma.item.update({
      where: { id: itemId },
      data: { stateId: done.id },
    });
  };

  it('raises tech debt from a ticket: Open TD-n, linked, createdFrom set', async () => {
    const w = await setup();
    const mine = await w.feature({ assigneeId: w.member.id });
    const res = await raise(w.member.cookie, mine.id);
    expect(res.status).toBe(201);
    const doc = (await read(res)) as Debt;
    expect([doc.kind, doc.number, doc.status]).toEqual([
      'TECH_DEBT',
      1,
      'OPEN',
    ]);
    expect(doc.homeItemId).toBeNull();
    expect(doc.createdFrom?.key).toBe(mine.key);
    expect(doc.items.map((i) => i.key)).toEqual([mine.key]);
    expect(doc.fixedBy).toBeNull();
    const second = (await read(await raise(w.owner, mine.id, 'Two'))) as Debt;
    expect(second.number).toBe(2);
    const item = (await read(
      await api.send('GET', `/api/items/${mine.id}`, w.member.cookie),
    )) as { related: { kind: string; number: number; status: string }[] };
    expect(item.related.map((r) => [r.kind, r.number, r.status])).toEqual([
      ['TECH_DEBT', 1, 'OPEN'],
      ['TECH_DEBT', 2, 'OPEN'],
    ]);
  });

  it('numbers tech debt apart from ADRs, per project', async () => {
    const w = await setup();
    const ticket = await w.feature();
    await api.send('POST', `/api/items/${ticket.id}/documents/new`, w.owner, {
      kind: 'ADR',
      title: 'An ADR',
    });
    expect(((await read(await raise(w.owner, ticket.id))) as Debt).number).toBe(
      1,
    );
    const other = await setup();
    const otherTicket = await other.feature();
    expect(
      ((await read(await raise(other.owner, otherTicket.id))) as Debt).number,
    ).toBe(1);
  });

  it('refuses to raise from a ticket the member cannot edit, in Standard, or from Knowledge', async () => {
    const w = await setup();
    const theirs = await w.feature();
    expect((await raise(w.member.cookie, theirs.id)).status).toBe(403);
    expect((await raise(w.outsider, theirs.id)).status).toBe(404);
    expect(await prisma.document.count({ where: { projectId: w.id } })).toBe(0);

    const standard = await setup('STANDARD');
    const task = await standard.feature();
    const res = await raise(standard.owner, task.id);
    expect(res.status).toBe(409);
    expect(((await read(res)) as Debt).code).toBe('guided_only');

    const knowledge = await api.send(
      'POST',
      `/api/projects/${w.id}/documents`,
      w.owner,
      { kind: 'TECH_DEBT', title: 'No' },
    );
    expect(knowledge.status).toBe(409);
    expect(((await read(knowledge)) as Debt).code).toBe('raise_from_ticket');
  });

  it("closes as Won't fix, owners and managers only, once", async () => {
    const w = await setup();
    const ticket = await w.feature({ assigneeId: w.member.id });
    const doc = (await read(await raise(w.member.cookie, ticket.id))) as Debt;
    expect(
      (await status(w.member.cookie, doc.id, { status: 'WONT_FIX' })).status,
    ).toBe(403);
    expect(
      (await status(w.outsider, doc.id, { status: 'WONT_FIX' })).status,
    ).toBe(404);
    const res = await status(w.owner, doc.id, { status: 'WONT_FIX' });
    expect(res.status).toBe(200);
    expect(((await read(res)) as Debt).status).toBe('WONT_FIX');
    const again = await status(w.owner, doc.id, { status: 'FIXED' });
    expect(again.status).toBe(409);
    expect(((await read(again)) as Debt).code).toBe('invalid_status');
  });

  it('fixes with a Done ticket of the project: stored and linked', async () => {
    const w = await setup();
    const ticket = await w.feature();
    const fixer = await w.feature({ title: 'Fix it' });
    const doc = (await read(await raise(w.owner, ticket.id))) as Debt;
    await finish(w.id, fixer.id);
    expect(
      (
        await status(w.member.cookie, doc.id, {
          status: 'FIXED',
          fixedByItemId: fixer.id,
        })
      ).status,
    ).toBe(403);
    const res = await status(w.owner, doc.id, {
      status: 'FIXED',
      fixedByItemId: fixer.id,
    });
    expect(res.status).toBe(200);
    const fixed = (await read(res)) as Debt;
    expect(fixed.status).toBe('FIXED');
    expect(fixed.fixedBy?.key).toBe(fixer.key);
    expect(fixed.createdFrom?.key).toBe(ticket.key);
    expect(fixed.items.map((i) => i.key).toSorted()).toEqual(
      [ticket.key, fixer.key].toSorted(),
    );
  });

  it('refuses Fixed without a Done ticket of this project: 409 fix_not_done', async () => {
    const w = await setup();
    const ticket = await w.feature();
    const notDone = await w.feature({ title: 'Not done' });
    const doc = (await read(await raise(w.owner, ticket.id))) as Debt;
    const refuse = async (body: Record<string, unknown>) => {
      const res = await status(w.owner, doc.id, body);
      expect(res.status).toBe(409);
      expect(((await read(res)) as Debt).code).toBe('fix_not_done');
    };
    await refuse({ status: 'FIXED' });
    await refuse({ status: 'FIXED', fixedByItemId: notDone.id });
    const elsewhere = await setup();
    const foreign = await elsewhere.feature();
    await finish(elsewhere.id, foreign.id);
    // The owner of this project is not a member of the other one: not found.
    const hidden = await status(w.owner, doc.id, {
      status: 'FIXED',
      fixedByItemId: foreign.id,
    });
    expect(hidden.status).toBe(404);
    const stored = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect([stored.status, stored.fixedByItemId]).toEqual(['OPEN', null]);
    const wrongWay = await status(w.owner, doc.id, {
      status: 'WONT_FIX',
      fixedByItemId: notDone.id,
    });
    expect(wrongWay.status).toBe(409);
    expect(((await read(wrongWay)) as Debt).code).toBe('invalid_status');
  });

  it('applies only one of two status moves made at the same moment', async () => {
    const w = await setup();
    const ticket = await w.feature();
    const fixer = await w.feature({ title: 'Fix it' });
    await finish(w.id, fixer.id);
    const doc = (await read(await raise(w.owner, ticket.id))) as Debt;
    const [fix, drop] = await Promise.all([
      status(w.owner, doc.id, { status: 'FIXED', fixedByItemId: fixer.id }),
      status(w.owner, doc.id, { status: 'WONT_FIX' }),
    ]);
    expect([fix.status, drop.status].toSorted((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    const stored = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(stored.status).toBe(fix.status === 200 ? 'FIXED' : 'WONT_FIX');
    // A lost move leaves no fixing ticket behind.
    expect(stored.fixedByItemId).toBe(fix.status === 200 ? fixer.id : null);
  });

  it('refuses Fixed by a Done ticket of another project the caller belongs to', async () => {
    const w = await setup();
    const ticket = await w.feature();
    const doc = (await read(await raise(w.owner, ticket.id))) as Debt;
    const created = await api.send('POST', '/api/projects', w.owner, {
      name: 'B',
      keyPrefix: freshPrefix(),
      mode: 'GUIDED',
    });
    const other = (await read(created)) as { id: string };
    const foreign = (await read(
      await api.send('POST', `/api/projects/${other.id}/items`, w.owner, {
        kind: 'FEATURE',
        title: 'Elsewhere',
      }),
    )) as { id: string };
    await finish(other.id, foreign.id);
    const res = await status(w.owner, doc.id, {
      status: 'FIXED',
      fixedByItemId: foreign.id,
    });
    expect(res.status).toBe(409);
    expect(((await read(res)) as Debt).code).toBe('fix_not_done');
  });

  it("lets a Manager set Won't fix", async () => {
    const w = await setup();
    const manager = await api.signInReady();
    await api.send('POST', `/api/projects/${w.id}/members`, w.owner, {
      email: manager.profile.email,
      role: 'MANAGER',
    });
    const ticket = await w.feature();
    const doc = (await read(await raise(w.owner, ticket.id))) as Debt;
    const res = await status(manager.cookie, doc.id, { status: 'WONT_FIX' });
    expect(res.status).toBe(200);
    expect(((await read(res)) as Debt).status).toBe('WONT_FIX');
  });

  it('never archives tech debt: 409 tech_debt_not_archivable, canArchive false', async () => {
    const w = await setup();
    const ticket = await w.feature();
    const doc = (await read(await raise(w.owner, ticket.id))) as Debt;
    expect(doc.canArchive).toBe(false);
    const res = await api.send('PATCH', `/api/documents/${doc.id}`, w.owner, {
      archived: true,
    });
    expect(res.status).toBe(409);
    expect(((await read(res)) as Debt).code).toBe('tech_debt_not_archivable');
    const stored = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(stored.archivedAt).toBeNull();
  });

  it('shows no raised-on or fixed-by link for a deleted ticket', async () => {
    const w = await setup();
    const ticket = await w.feature();
    const fixer = await w.feature({ title: 'Fix it' });
    const doc = (await read(await raise(w.owner, ticket.id))) as Debt;
    await finish(w.id, fixer.id);
    await status(w.owner, doc.id, { status: 'FIXED', fixedByItemId: fixer.id });
    const listed = async () =>
      (
        (await read(
          await api.send(
            'GET',
            `/api/projects/${w.id}/documents?kind=TECH_DEBT`,
            w.owner,
          ),
        )) as Debt[]
      )[0];
    expect([
      (await listed()).createdFrom?.key,
      (await listed()).fixedBy?.key,
    ]).toEqual([ticket.key, fixer.key]);
    await prisma.item.updateMany({
      where: { id: { in: [ticket.id, fixer.id] } },
      data: { deletedAt: new Date() },
    });
    const row = await listed();
    expect([row.createdFrom, row.fixedBy]).toEqual([null, null]);
    const view = (await read(
      await api.send('GET', `/api/documents/${doc.id}`, w.owner),
    )) as Debt;
    expect([view.createdFrom, view.fixedBy]).toEqual([null, null]);
  });

  it('lists tech debt by kind with number and status', async () => {
    const w = await setup();
    const ticket = await w.feature();
    await raise(w.owner, ticket.id, 'Listed');
    const list = (await read(
      await api.send(
        'GET',
        `/api/projects/${w.id}/documents?kind=TECH_DEBT`,
        w.owner,
      ),
    )) as Debt[];
    expect(list.map((d) => [d.number, d.status])).toEqual([[1, 'OPEN']]);
  });
});
