import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Related {
  id: string;
  kind: string;
  number: number | null;
  status: string | null;
  title: string;
  archived: boolean;
  home: 'ticket' | 'project';
  from: string | null;
}

interface Item {
  id: string;
  key: string;
  related: Related[];
  code?: string;
}

interface Doc {
  id: string;
  homeItemId: string | null;
  homeItem: { key: string } | null;
  createdFrom: { key: string } | null;
  items: { key: string }[];
  canEdit: boolean;
  body?: string;
  code?: string;
  message?: string;
}

describe('ticket documents and links (e2e)', () => {
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
    // Clear parents first so deleting a project's items can't deadlock.
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

  /** A project in `mode` with an owner, a member, another member and an outsider. */
  const setup = async (mode: 'GUIDED' | 'STANDARD' = 'GUIDED') => {
    const owner = await api.signInReady();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'T',
      keyPrefix: freshPrefix(),
      mode,
    });
    const { id } = (await read(created)) as { id: string };
    const join = async () => {
      const p = await api.signInReady();
      await api.send('POST', `/api/projects/${id}/members`, owner.cookie, {
        email: p.profile.email,
        role: 'MEMBER',
      });
      const user = await prisma.user.findFirstOrThrow({
        where: { email: p.profile.email },
      });
      return { cookie: p.cookie, id: user.id };
    };
    const member = await join();
    const other = await join();
    const outsider = (await api.signInReady()).cookie;
    const kinds =
      mode === 'GUIDED' ? ['FEATURE', 'SLICE'] : ['TASK', 'SUBTASK'];
    const add = async (
      kind: string,
      title: string,
      extra: Record<string, unknown> = {},
    ) => {
      const res = await api.send(
        'POST',
        `/api/projects/${id}/items`,
        owner.cookie,
        { kind, title, ...extra },
      );
      return (await read(res)) as Item;
    };
    const parent = await add(kinds[0], 'Parent');
    const child = await add(kinds[1], 'Child', { parentId: parent.id });
    const knowledge = async (title: string, kind = 'REFERENCE') => {
      const res = await api.send(
        'POST',
        `/api/projects/${id}/documents`,
        owner.cookie,
        { kind, title },
      );
      return (await read(res)) as Doc;
    };
    const item = async (cookie: string, itemId: string) =>
      (await read(
        await api.send('GET', `/api/items/${itemId}`, cookie),
      )) as Item;
    return {
      id,
      owner: owner.cookie,
      member,
      other,
      outsider,
      parent,
      child,
      add,
      knowledge,
      item,
    };
  };

  const newDoc = (cookie: string, itemId: string, title = 'Spec') =>
    api.send('POST', `/api/items/${itemId}/documents/new`, cookie, {
      kind: 'SPEC',
      title,
      body: '# Spec',
    });

  const link = (cookie: string, itemId: string, documentId: string) =>
    api.send('POST', `/api/items/${itemId}/documents`, cookie, { documentId });

  it('writes a spec on the ticket: homeItemId and createdFrom set, hidden from Knowledge', async () => {
    const w = await setup();
    const res = await newDoc(w.owner, w.parent.id);
    expect(res.status).toBe(201);
    const doc = (await read(res)) as Doc;
    expect(doc.homeItemId).toBe(w.parent.id);
    expect(doc.homeItem?.key).toBe(w.parent.key);
    expect(doc.createdFrom?.key).toBe(w.parent.key);
    expect(doc.canEdit).toBe(true);

    const listOf = async (query = '') =>
      (await read(
        await api.send(
          'GET',
          `/api/projects/${w.id}/documents${query}`,
          w.owner,
        ),
      )) as Doc[];
    expect(await listOf()).toHaveLength(0);
    expect(await listOf('?includeTicketDocuments=true')).toHaveLength(1);
    expect(
      await prisma.itemDocument.count({ where: { documentId: doc.id } }),
    ).toBe(0);
  });

  it('follows the ticket edit rule: a member writes on their own ticket only', async () => {
    const w = await setup();
    const mine = await w.add('FEATURE', 'Mine', { assigneeId: w.member.id });
    const theirs = await w.add('FEATURE', 'Theirs', { assigneeId: w.other.id });

    expect((await newDoc(w.member.cookie, mine.id)).status).toBe(201);
    const refused = await newDoc(w.member.cookie, theirs.id);
    expect(refused.status).toBe(403);
    expect(((await read(refused)) as Doc).message).toMatch(/assigned to them/);
    expect((await newDoc(w.outsider, mine.id)).status).toBe(404);

    // PATCH on a ticket document: the ticket's rule, not the Knowledge role rule.
    const own = (await read(await newDoc(w.owner, mine.id, 'On mine'))) as Doc;
    const edit = (cookie: string, docId: string) =>
      api.send('PATCH', `/api/documents/${docId}`, cookie, { body: 'new' });
    expect((await edit(w.member.cookie, own.id)).status).toBe(200);
    const foreign = (await read(
      await newDoc(w.owner, theirs.id, 'On theirs'),
    )) as Doc;
    expect((await edit(w.member.cookie, foreign.id)).status).toBe(403);
    expect((await edit(w.owner, foreign.id)).status).toBe(200);

    const read1 = (await read(
      await api.send('GET', `/api/documents/${own.id}`, w.member.cookie),
    )) as Doc;
    expect(read1.canEdit).toBe(true);
    const read2 = (await read(
      await api.send('GET', `/api/documents/${foreign.id}`, w.member.cookie),
    )) as Doc;
    expect(read2.canEdit).toBe(false);
  });

  it('keeps Knowledge documents owner and manager only', async () => {
    const w = await setup();
    const doc = await w.knowledge('Stack');
    const res = await api.send(
      'PATCH',
      `/api/documents/${doc.id}`,
      w.member.cookie,
      { body: 'x' },
    );
    expect(res.status).toBe(403);
  });

  it('answers 409 guided_only in a Standard project', async () => {
    const w = await setup('STANDARD');
    const doc = await w.knowledge('Stack');
    const created = await newDoc(w.owner, w.parent.id);
    expect(created.status).toBe(409);
    expect(((await read(created)) as Doc).code).toBe('guided_only');
    const linked = await link(w.owner, w.parent.id, doc.id);
    expect(linked.status).toBe(409);
    const unlinked = await api.send(
      'DELETE',
      `/api/items/${w.parent.id}/documents/${doc.id}`,
      w.owner,
    );
    expect(unlinked.status).toBe(409);
    expect((await w.item(w.owner, w.parent.id)).related).toEqual([]);
  });

  it('links and unlinks a Knowledge document; linking twice is a no-op', async () => {
    const w = await setup();
    const doc = await w.knowledge('Stack');
    const first = await link(w.owner, w.parent.id, doc.id);
    expect(first.status).toBe(200);
    expect(((await read(first)) as Item).related).toEqual([
      {
        id: doc.id,
        kind: 'REFERENCE',
        number: null,
        status: null,
        title: 'Stack',
        archived: false,
        home: 'project',
        from: null,
      },
    ]);
    expect((await link(w.owner, w.parent.id, doc.id)).status).toBe(200);
    expect(
      await prisma.itemDocument.count({ where: { documentId: doc.id } }),
    ).toBe(1);

    const page = (await read(
      await api.send('GET', `/api/documents/${doc.id}`, w.owner),
    )) as Doc;
    expect(page.items.map((i) => i.key)).toEqual([w.parent.key]);

    const gone = await api.send(
      'DELETE',
      `/api/items/${w.parent.id}/documents/${doc.id}`,
      w.owner,
    );
    expect(gone.status).toBe(200);
    expect((await w.item(w.owner, w.parent.id)).related).toEqual([]);
  });

  it('refuses links for a member who cannot edit, other projects, ticket documents and archived ones', async () => {
    const w = await setup();
    const doc = await w.knowledge('Stack');
    const denied = await link(w.member.cookie, w.parent.id, doc.id);
    expect(denied.status).toBe(403);
    expect((await link(w.outsider, w.parent.id, doc.id)).status).toBe(404);

    const ticketDoc = (await read(await newDoc(w.owner, w.parent.id))) as Doc;
    expect((await link(w.owner, w.child.id, ticketDoc.id)).status).toBe(404);

    const elsewhere = await setup();
    const foreign = await elsewhere.knowledge('Foreign');
    expect((await link(w.owner, w.parent.id, foreign.id)).status).toBe(404);
    expect(
      (await link(w.owner, w.parent.id, '00000000-0000-7000-8000-000000000000'))
        .status,
    ).toBe(404);

    const old = await w.knowledge('Old');
    await api.send('PATCH', `/api/documents/${old.id}`, w.owner, {
      archived: true,
    });
    const archived = await link(w.owner, w.parent.id, old.id);
    expect(archived.status).toBe(409);
    expect(((await read(archived)) as Doc).code).toBe('document_archived');
  });

  it('shows own, linked and inherited documents in related; existing archived links stay', async () => {
    const w = await setup();
    const spec = (await read(
      await newDoc(w.owner, w.parent.id, 'Spec'),
    )) as Doc;
    const stack = await w.knowledge('Stack');
    const retired = await w.knowledge('Retired');
    await link(w.owner, w.parent.id, stack.id);
    await link(w.owner, w.child.id, retired.id);
    await api.send('PATCH', `/api/documents/${retired.id}`, w.owner, {
      archived: true,
    });

    const parent = await w.item(w.owner, w.parent.id);
    expect(parent.related.map((r) => [r.title, r.home, r.from])).toEqual([
      ['Spec', 'ticket', null],
      ['Stack', 'project', null],
    ]);

    const child = await w.item(w.member.cookie, w.child.id);
    expect(
      child.related.map((r) => [r.title, r.home, r.from, r.archived]),
    ).toEqual([
      ['Spec', 'ticket', w.parent.key, false],
      ['Stack', 'project', w.parent.key, false],
      ['Retired', 'project', null, true],
    ]);
    expect(child.related.every((r) => !('body' in r))).toBe(true);
    expect(spec.id).toBe(parent.related[0].id);
  });

  it('unlinks only for people who can edit the ticket, and only Knowledge documents of the project', async () => {
    const w = await setup();
    const doc = await w.knowledge('Stack');
    await link(w.owner, w.parent.id, doc.id);
    const unlink = (cookie: string, itemId: string, documentId: string) =>
      api.send(
        'DELETE',
        `/api/items/${itemId}/documents/${documentId}`,
        cookie,
      );

    expect((await unlink(w.member.cookie, w.parent.id, doc.id)).status).toBe(
      403,
    );
    expect((await unlink(w.outsider, w.parent.id, doc.id)).status).toBe(404);
    expect(
      await prisma.itemDocument.count({ where: { documentId: doc.id } }),
    ).toBe(1);

    const ticketDoc = (await read(await newDoc(w.owner, w.parent.id))) as Doc;
    expect((await unlink(w.owner, w.parent.id, ticketDoc.id)).status).toBe(404);

    const elsewhere = await setup();
    const foreign = await elsewhere.knowledge('Foreign');
    expect((await unlink(w.owner, w.parent.id, foreign.id)).status).toBe(404);
  });

  it('unlinks an archived document', async () => {
    const w = await setup();
    const doc = await w.knowledge('Retired');
    await link(w.owner, w.parent.id, doc.id);
    await api.send('PATCH', `/api/documents/${doc.id}`, w.owner, {
      archived: true,
    });
    const res = await api.send(
      'DELETE',
      `/api/items/${w.parent.id}/documents/${doc.id}`,
      w.owner,
    );
    expect(res.status).toBe(200);
    expect(
      await prisma.itemDocument.count({ where: { documentId: doc.id } }),
    ).toBe(0);
  });

  it('answers 404 for a ticket document whose ticket was deleted', async () => {
    const w = await setup();
    const lone = await w.add('FEATURE', 'Lone');
    const spec = (await read(await newDoc(w.owner, lone.id))) as Doc;
    const deleted = await api.send('DELETE', `/api/items/${lone.id}`, w.owner);
    expect(deleted.status).toBe(200);
    const res = await api.send('GET', `/api/documents/${spec.id}`, w.owner);
    expect(res.status).toBe(404);
    expect(((await read(res)) as Doc).message).toBe('Document not found');
    const listed = (await read(
      await api.send(
        'GET',
        `/api/projects/${w.id}/documents?includeTicketDocuments=true`,
        w.owner,
      ),
    )) as Doc[];
    expect(listed).toHaveLength(0);
  });

  it('removes ticket documents with the ticket; a Knowledge document keeps living with createdFrom null', async () => {
    const w = await setup();
    const spec = (await read(await newDoc(w.owner, w.parent.id))) as Doc;
    const stack = await w.knowledge('Stack');
    await prisma.document.update({
      where: { id: stack.id },
      data: { createdFromItemId: w.parent.id },
    });
    const before = (await read(
      await api.send('GET', `/api/documents/${stack.id}`, w.owner),
    )) as Doc;
    expect(before.createdFrom?.key).toBe(w.parent.key);

    await prisma.item.updateMany({
      where: { parentId: w.parent.id },
      data: { parentId: null },
    });
    await prisma.item.delete({ where: { id: w.parent.id } });
    expect(await prisma.document.count({ where: { id: spec.id } })).toBe(0);
    const after = (await read(
      await api.send('GET', `/api/documents/${stack.id}`, w.owner),
    )) as Doc;
    expect(after.createdFrom).toBeNull();
  });
});
