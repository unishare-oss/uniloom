import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Adr {
  id: string;
  kind: string;
  number: number | null;
  status: string | null;
  supersededBy: { id: string; number: number } | null;
  createdFrom: { key: string } | null;
  homeItemId: string | null;
  items: { key: string }[];
  canEdit: boolean;
  body: string;
  code?: string;
  message?: string;
}

describe('ADRs (e2e)', () => {
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

  const adr = (cookie: string, projectId: string, title = 'Use X') =>
    api.send('POST', `/api/projects/${projectId}/documents`, cookie, {
      kind: 'ADR',
      title,
    });
  const status = (
    cookie: string,
    docId: string,
    body: Record<string, unknown>,
  ) => api.send('POST', `/api/documents/${docId}/status`, cookie, body);
  const accepted = async (
    w: Awaited<ReturnType<typeof setup>>,
    title: string,
  ) => {
    const doc = (await read(await adr(w.owner, w.id, title))) as Adr;
    await status(w.owner, doc.id, { status: 'ACCEPTED' });
    return doc;
  };

  it('numbers ADRs per project from 1 and starts them Proposed', async () => {
    const w = await setup();
    const first = (await read(await adr(w.owner, w.id, 'One'))) as Adr;
    const second = (await read(await adr(w.owner, w.id, 'Two'))) as Adr;
    expect([first.number, first.status]).toEqual([1, 'PROPOSED']);
    expect(second.number).toBe(2);
    const other = await setup();
    expect(((await read(await adr(other.owner, other.id))) as Adr).number).toBe(
      1,
    );
  });

  it('gives concurrent creates different numbers', async () => {
    const w = await setup();
    const made = await Promise.all([
      adr(w.owner, w.id, 'ADR 1'),
      adr(w.owner, w.id, 'ADR 2'),
      adr(w.owner, w.id, 'ADR 3'),
      adr(w.owner, w.id, 'ADR 4'),
    ]);
    const numbers: (number | null)[] = [];
    for (const res of made) numbers.push(((await read(res)) as Adr).number);
    expect(numbers.toSorted((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('keeps Knowledge creation owner and manager only, Guided only', async () => {
    const w = await setup();
    expect((await adr(w.member.cookie, w.id)).status).toBe(403);
    expect((await adr(w.outsider, w.id)).status).toBe(404);
    const standard = await setup('STANDARD');
    const res = await adr(standard.owner, standard.id);
    expect(res.status).toBe(409);
    expect(((await read(res)) as Adr).code).toBe('guided_only');
  });

  it('raises an ADR from a ticket: Knowledge document, linked, createdFrom set', async () => {
    const w = await setup();
    const mine = await w.feature({ assigneeId: w.member.id });
    const res = await api.send(
      'POST',
      `/api/items/${mine.id}/documents/new`,
      w.member.cookie,
      { kind: 'ADR', title: 'Raised', body: '## Context' },
    );
    expect(res.status).toBe(201);
    const doc = (await read(res)) as Adr;
    expect([doc.kind, doc.number, doc.status]).toEqual(['ADR', 1, 'PROPOSED']);
    expect(doc.homeItemId).toBeNull();
    expect(doc.createdFrom?.key).toBe(mine.key);
    expect(doc.items.map((i) => i.key)).toEqual([mine.key]);
    // The author is a Member: kept out of editing, like every Knowledge document.
    expect(doc.canEdit).toBe(false);
    const edit = await api.send(
      'PATCH',
      `/api/documents/${doc.id}`,
      w.member.cookie,
      { body: 'x' },
    );
    expect(edit.status).toBe(403);
    const item = (await read(
      await api.send('GET', `/api/items/${mine.id}`, w.member.cookie),
    )) as { related: { number: number; status: string }[] };
    expect(item.related.map((r) => [r.number, r.status])).toEqual([
      [1, 'PROPOSED'],
    ]);
  });

  it('refuses an ADR from a ticket the member cannot edit, and in a Standard project', async () => {
    const w = await setup();
    const theirs = await w.feature();
    const denied = await api.send(
      'POST',
      `/api/items/${theirs.id}/documents/new`,
      w.member.cookie,
      { kind: 'ADR', title: 'No' },
    );
    expect(denied.status).toBe(403);
    expect(await prisma.document.count({ where: { projectId: w.id } })).toBe(0);

    const standard = await setup('STANDARD');
    const task = await standard.feature();
    const res = await api.send(
      'POST',
      `/api/items/${task.id}/documents/new`,
      standard.owner,
      { kind: 'ADR', title: 'No' },
    );
    expect(res.status).toBe(409);
    expect(((await read(res)) as Adr).code).toBe('guided_only');
  });

  it('accepts and rejects as owner or manager only', async () => {
    const w = await setup();
    const doc = (await read(await adr(w.owner, w.id))) as Adr;
    expect(
      (await status(w.member.cookie, doc.id, { status: 'ACCEPTED' })).status,
    ).toBe(403);
    expect(
      (await status(w.outsider, doc.id, { status: 'ACCEPTED' })).status,
    ).toBe(404);
    const res = await status(w.owner, doc.id, { status: 'ACCEPTED' });
    expect(res.status).toBe(200);
    expect(((await read(res)) as Adr).status).toBe('ACCEPTED');

    const rejected = (await read(await adr(w.owner, w.id, 'No'))) as Adr;
    expect(
      (
        (await read(
          await status(w.owner, rejected.id, { status: 'REJECTED' }),
        )) as Adr
      ).status,
    ).toBe('REJECTED');
  });

  it('answers 409 invalid_status for moves the rules do not allow', async () => {
    const w = await setup();
    const proposed = (await read(await adr(w.owner, w.id))) as Adr;
    const refuse = async (docId: string, body: Record<string, unknown>) => {
      const res = await status(w.owner, docId, body);
      expect(res.status).toBe(409);
      expect(((await read(res)) as Adr).code).toBe('invalid_status');
    };
    await refuse(proposed.id, { status: 'SUPERSEDED' });
    await refuse(proposed.id, { status: 'OPEN' });
    await refuse(proposed.id, { status: 'PROPOSED' });
    await status(w.owner, proposed.id, { status: 'REJECTED' });
    await refuse(proposed.id, { status: 'ACCEPTED' });
  });

  it('applies only one of two status moves made at the same moment', async () => {
    const w = await setup();
    const doc = (await read(await adr(w.owner, w.id))) as Adr;
    const [accept, reject] = await Promise.all([
      status(w.owner, doc.id, { status: 'ACCEPTED' }),
      status(w.owner, doc.id, { status: 'REJECTED' }),
    ]);
    expect([accept.status, reject.status].toSorted((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    const loser = accept.status === 409 ? accept : reject;
    expect(((await read(loser)) as Adr).code).toBe('invalid_status');
    const stored = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(stored.status).toBe(accept.status === 200 ? 'ACCEPTED' : 'REJECTED');
  });

  it('tells the web which document kinds a project and a ticket have', async () => {
    const w = await setup();
    const project = (await read(
      await api.send('GET', `/api/projects/${w.id}`, w.owner),
    )) as { documentKinds: string[] };
    expect(project.documentKinds).toContain('ADR');
    const ticket = await w.feature();
    const item = (await read(
      await api.send('GET', `/api/items/${ticket.id}`, w.owner),
    )) as { ticketDocumentKinds: string[] };
    expect(item.ticketDocumentKinds).toEqual(['SPEC', 'ADR', 'TECH_DEBT']);

    const standard = await setup('STANDARD');
    const standardProject = (await read(
      await api.send('GET', `/api/projects/${standard.id}`, standard.owner),
    )) as { documentKinds: string[] };
    expect(standardProject.documentKinds).not.toContain('ADR');
    expect(standardProject.documentKinds).not.toContain('TECH_DEBT');
    const task = await standard.feature();
    const standardItem = (await read(
      await api.send('GET', `/api/items/${task.id}`, standard.owner),
    )) as { ticketDocumentKinds: string[] };
    expect(standardItem.ticketDocumentKinds).toEqual([]);
  });

  it('supersedes an Accepted ADR by a newer Accepted one only', async () => {
    const w = await setup();
    const old = await accepted(w, 'Old');
    const proposed = (await read(await adr(w.owner, w.id, 'Later'))) as Adr;
    const newer = await accepted(w, 'Newer');
    const refuse = async (body: Record<string, unknown>) => {
      const res = await status(w.owner, old.id, body);
      expect(res.status).toBe(409);
      expect(((await read(res)) as Adr).code).toBe('invalid_status');
    };
    await refuse({ status: 'SUPERSEDED' });
    await refuse({ status: 'SUPERSEDED', supersededById: old.id });
    await refuse({ status: 'SUPERSEDED', supersededById: proposed.id });
    const elsewhere = await setup();
    const foreign = await accepted(elsewhere, 'Foreign');
    await refuse({ status: 'SUPERSEDED', supersededById: foreign.id });

    const res = await status(w.owner, old.id, {
      status: 'SUPERSEDED',
      supersededById: newer.id,
    });
    expect(res.status).toBe(200);
    const done = (await read(res)) as Adr;
    expect(done.status).toBe('SUPERSEDED');
    expect(done.supersededBy?.id).toBe(newer.id);
    expect(done.supersededBy?.number).toBe(newer.number);
  });

  it('refuses to archive an ADR and keeps the status when an Accepted ADR is edited', async () => {
    const w = await setup();
    const doc = await accepted(w, 'Keep');
    const archive = await api.send(
      'PATCH',
      `/api/documents/${doc.id}`,
      w.owner,
      { archived: true },
    );
    expect(archive.status).toBe(409);
    expect(((await read(archive)) as Adr).code).toBe('adr_not_archivable');

    const edit = await api.send('PATCH', `/api/documents/${doc.id}`, w.owner, {
      body: '## Decision',
    });
    expect(edit.status).toBe(200);
    const edited = (await read(edit)) as Adr;
    expect([edited.status, edited.body]).toEqual(['ACCEPTED', '## Decision']);
  });

  it('lists ADRs by kind with number and status', async () => {
    const w = await setup();
    await accepted(w, 'Listed');
    const list = (await read(
      await api.send(
        'GET',
        `/api/projects/${w.id}/documents?kind=ADR`,
        w.owner,
      ),
    )) as Adr[];
    expect(list.map((d) => [d.number, d.status])).toEqual([[1, 'ACCEPTED']]);
  });
});
