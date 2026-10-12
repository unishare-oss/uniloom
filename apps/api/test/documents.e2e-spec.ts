import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Doc {
  id: string;
  kind: string;
  title: string;
  body?: string;
  canEdit: boolean;
  archivedAt: string | null;
  author: { name: string } | null;
  code?: string;
}

describe('documents (e2e)', () => {
  let api: Awaited<ReturnType<typeof startTestApi>>;

  beforeAll(async () => {
    api = await startTestApi();
  });

  afterAll(async () => {
    await prisma.project.deleteMany({
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

  /** A project with an owner, a manager, two members and an outsider. */
  const setup = async () => {
    const owner = await api.signInReady();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'D',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id } = (await read(created)) as { id: string };
    const join = async (role: string) => {
      const p = await api.signInReady();
      const res = await api.send(
        'POST',
        `/api/projects/${id}/members`,
        owner.cookie,
        { email: p.profile.email, role },
      );
      expect(res.status).toBe(201);
      return p.cookie;
    };
    const manager = await join('MANAGER');
    const member = await join('MEMBER');
    const otherMember = await join('MEMBER');
    const outsider = (await api.signInReady()).cookie;
    const create = async (cookie: string, body: Record<string, unknown>) => {
      const res = await api.send(
        'POST',
        `/api/projects/${id}/documents`,
        cookie,
        body,
      );
      return { status: res.status, body: (await read(res)) as Doc };
    };
    const list = async (cookie: string, query = '') => {
      const res = await api.send(
        'GET',
        `/api/projects/${id}/documents${query}`,
        cookie,
      );
      return { status: res.status, body: (await read(res)) as Doc[] };
    };
    const edit = async (
      cookie: string,
      docId: string,
      body: Record<string, unknown>,
    ) => {
      const res = await api.send(
        'PATCH',
        `/api/documents/${docId}`,
        cookie,
        body,
      );
      return { status: res.status, body: (await read(res)) as Doc };
    };
    return {
      id,
      owner: owner.cookie,
      manager,
      member,
      otherMember,
      outsider,
      create,
      list,
      edit,
    };
  };

  it('creates for owners and managers; a member gets 403, an outsider 404', async () => {
    const w = await setup();
    const made = await w.create(w.manager, {
      kind: 'BRIEF',
      title: 'Brief',
      body: '# Hi',
    });
    expect(made.status).toBe(201);
    expect(made.body.author).not.toBeNull();
    expect(made.body.canEdit).toBe(true);
    expect((await w.create(w.owner, { kind: 'SPEC', title: 'S' })).status).toBe(
      201,
    );
    const denied = await w.create(w.member, { kind: 'BRIEF', title: 'No' });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('forbidden');
    expect(
      (await w.create(w.outsider, { kind: 'BRIEF', title: 'No' })).status,
    ).toBe(404);
    expect(
      (await w.create(w.owner, { kind: 'BRIEF', title: ' ' })).status,
    ).toBe(400);
  });

  it('lets every member read, without bodies in the list; an outsider gets 404', async () => {
    const w = await setup();
    const made = await w.create(w.owner, {
      kind: 'REFERENCE',
      title: 'Stack',
      body: 'text',
    });
    const list = await w.list(w.member);
    expect(list.body).toHaveLength(1);
    expect('body' in list.body[0]).toBe(false);
    expect(list.body[0].canEdit).toBe(false);
    const one = await api.send(
      'GET',
      `/api/documents/${made.body.id}`,
      w.member,
    );
    expect(((await read(one)) as Doc).body).toBe('text');
    expect((await w.list(w.outsider)).status).toBe(404);
    const hidden = await api.send(
      'GET',
      `/api/documents/${made.body.id}`,
      w.outsider,
    );
    expect(hidden.status).toBe(404);
    const missing = await api.send(
      'GET',
      '/api/documents/00000000-0000-7000-8000-000000000000',
      w.owner,
    );
    expect(missing.status).toBe(404);
  });

  it('lets an owner and a manager edit any document; a member only reads', async () => {
    const w = await setup();
    const made = await w.create(w.owner, { kind: 'PROPOSAL', title: 'P' });
    const byManager = await w.edit(w.manager, made.body.id, { title: 'P2' });
    expect(byManager.status).toBe(200);
    expect(byManager.body.title).toBe('P2');
    const denied = await w.edit(w.otherMember, made.body.id, { title: 'X' });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('forbidden');
    expect(
      (await w.edit(w.outsider, made.body.id, { title: 'X' })).status,
    ).toBe(404);
  });

  it('refuses a blank title or a purpose over 300 on edit, and a member archiving', async () => {
    const w = await setup();
    const made = await w.create(w.owner, { kind: 'BRIEF', title: 'T' });
    expect((await w.edit(w.owner, made.body.id, { title: ' ' })).status).toBe(
      400,
    );
    expect(
      (await w.edit(w.owner, made.body.id, { purpose: 'x'.repeat(301) }))
        .status,
    ).toBe(400);
    const denied = await w.edit(w.otherMember, made.body.id, {
      archived: true,
    });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('forbidden');
  });

  it('lets an author who is now only a member keep editing their own document', async () => {
    const w = await setup();
    const made = await w.create(w.manager, { kind: 'SPEC', title: 'Mine' });
    const members = (await read(
      await api.send('GET', `/api/projects/${w.id}/members`, w.owner),
    )) as { userId: string; role: string }[];
    const managerRow = members.find((m) => m.role === 'MANAGER');
    const demote = await api.send(
      'PATCH',
      `/api/projects/${w.id}/members/${managerRow?.userId}`,
      w.owner,
      { role: 'MEMBER' },
    );
    expect(demote.status).toBe(200);
    const edited = await w.edit(w.manager, made.body.id, { body: 'new' });
    expect(edited.status).toBe(200);
    expect(edited.body.body).toBe('new');
    const seen = (await w.list(w.manager)).body[0];
    expect(seen.canEdit).toBe(true);
  });

  it('archives and restores, and the list hides archived ones unless asked', async () => {
    const w = await setup();
    const a = await w.create(w.owner, { kind: 'BRIEF', title: 'Keep' });
    const b = await w.create(w.owner, { kind: 'BRIEF', title: 'Old' });
    const archived = await w.edit(w.owner, b.body.id, { archived: true });
    expect(archived.body.archivedAt).not.toBeNull();
    expect((await w.list(w.member)).body.map((d) => d.id)).toEqual([a.body.id]);
    expect(
      (await w.list(w.member, '?archived=true')).body.map((d) => d.id).sort(),
    ).toEqual([a.body.id, b.body.id].sort());
    const restored = await w.edit(w.owner, b.body.id, { archived: false });
    expect(restored.body.archivedAt).toBeNull();
    expect((await w.list(w.member)).body).toHaveLength(2);
  });

  it('filters by kind and title search, newest edit first', async () => {
    const w = await setup();
    const brief = await w.create(w.owner, {
      kind: 'BRIEF',
      title: 'Alpha plan',
    });
    await w.create(w.owner, { kind: 'SPEC', title: 'Beta spec' });
    await w.create(w.owner, { kind: 'SPEC', title: 'Gamma ALPHA' });
    expect((await w.list(w.member, '?kind=SPEC')).body).toHaveLength(2);
    const found = await w.list(w.member, '?q=alpha');
    expect(found.body.map((d) => d.title).sort()).toEqual([
      'Alpha plan',
      'Gamma ALPHA',
    ]);
    expect((await w.list(w.member, '?kind=SPEC&q=alpha')).body).toHaveLength(1);
    expect((await w.list(w.member, '?kind=NOPE')).status).toBe(400);
    await w.edit(w.owner, brief.body.id, { purpose: 'bump' });
    expect((await w.list(w.member)).body[0].id).toBe(brief.body.id);
  });

  it('deletes documents with the project', async () => {
    const w = await setup();
    const made = await w.create(w.owner, { kind: 'BRIEF', title: 'Gone' });
    await prisma.project.delete({ where: { id: w.id } });
    expect(
      await prisma.document.findUnique({ where: { id: made.body.id } }),
    ).toBeNull();
  });
});
