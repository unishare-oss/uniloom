import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Node {
  id: string;
  body: string;
  deleted: boolean;
  editedAt: string | null;
  isTargetAuthor: boolean;
  canEdit: boolean;
  canDelete: boolean;
  author: { name: string } | null;
  replies: Node[];
}

describe('ticket comments (e2e)', () => {
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

  const person = async () => {
    const { cookie, profile } = await api.signInReady();
    return { cookie, email: profile.email };
  };

  /** A project with an owner, a manager and a member, and one ticket made by the owner. */
  const setup = async (guided = false) => {
    const owner = await person();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'W',
      keyPrefix: freshPrefix(),
      mode: guided ? 'GUIDED' : 'STANDARD',
    });
    const { id: projectId } = (await read(created)) as { id: string };
    const join = async (role: string) => {
      const p = await person();
      const res = await api.send(
        'POST',
        `/api/projects/${projectId}/members`,
        owner.cookie,
        { email: p.email, role },
      );
      expect(res.status).toBe(201);
      return p;
    };
    const manager = await join('MANAGER');
    const member = await join('MEMBER');
    const other = await join('MEMBER');
    const stranger = await person();
    const makeItem = async () =>
      (await read(
        await api.send(
          'POST',
          `/api/projects/${projectId}/items`,
          owner.cookie,
          { kind: guided ? 'FEATURE' : 'TASK', title: 'T' },
        ),
      )) as { id: string };
    const item = await makeItem();
    const post = (cookie: string, body: unknown, itemId = item.id) =>
      api.send('POST', `/api/items/${itemId}/comments`, cookie, body);
    const tree = async (cookie: string, itemId = item.id) =>
      read<{ count: number; comments: Node[] }>(
        await api.send('GET', `/api/items/${itemId}/comments`, cookie),
      );
    return {
      projectId,
      owner,
      manager,
      member,
      other,
      stranger,
      item,
      makeItem,
      post,
      tree,
    };
  };

  it('lets any member comment and reply, and lists the nested tree oldest first', async () => {
    const w = await setup();
    const first = await read<Node>(
      await w.post(w.member.cookie, { body: '  Hello  ' }),
    );
    expect(first).toMatchObject({
      body: 'Hello',
      canEdit: true,
      canDelete: true,
    });
    const reply = await read<Node>(
      await w.post(w.owner.cookie, { body: 'Hi', parentId: first.id }),
    );
    await w.post(w.other.cookie, { body: 'Second' });
    await w.post(w.manager.cookie, { body: 'Deep', parentId: reply.id });

    const seen = await w.tree(w.owner.cookie);
    expect(seen.count).toBe(4);
    expect(seen.comments.map((c) => c.body)).toEqual(['Hello', 'Second']);
    expect(seen.comments[0].replies[0]).toMatchObject({
      body: 'Hi',
      isTargetAuthor: true,
    });
    expect(seen.comments[0].replies[0].replies[0].body).toBe('Deep');
  });

  it('refuses empty, whitespace-only and over-long bodies', async () => {
    const w = await setup();
    for (const body of ['', '   \n ']) {
      const res = await w.post(w.member.cookie, { body });
      expect(res.status).toBe(400);
      expect(await read(res)).toMatchObject({ code: 'empty_comment' });
    }
    const long = await w.post(w.member.cookie, { body: 'a'.repeat(2001) });
    expect(long.status).toBe(400);
    expect(await read(long)).toMatchObject({ code: 'comment_too_long' });
    expect(
      (await w.post(w.member.cookie, { body: 'a'.repeat(2000) })).status,
    ).toBe(201);
  });

  it('answers not_found for a missing, deleted or other-ticket parent', async () => {
    const w = await setup();
    const otherItem = await w.makeItem();
    const onOther = await read<Node>(
      await w.post(w.member.cookie, { body: 'x' }, otherItem.id),
    );
    const mine = await read<Node>(await w.post(w.member.cookie, { body: 'y' }));
    await api.send('DELETE', `/api/comments/${mine.id}`, w.member.cookie);

    for (const parentId of [randomUUID(), onOther.id, mine.id]) {
      const res = await w.post(w.member.cookie, { body: 'z', parentId });
      expect(res.status).toBe(404);
      expect(await read(res)).toMatchObject({ code: 'not_found' });
    }
  });

  it('hides comments from people outside the project', async () => {
    const w = await setup();
    const c = await read<Node>(await w.post(w.member.cookie, { body: 'x' }));
    expect(
      (
        await api.send(
          'GET',
          `/api/items/${w.item.id}/comments`,
          w.stranger.cookie,
        )
      ).status,
    ).toBe(404);
    expect((await w.post(w.stranger.cookie, { body: 'x' })).status).toBe(404);
    expect(
      (
        await api.send('PATCH', `/api/comments/${c.id}`, w.stranger.cookie, {
          body: 'y',
        })
      ).status,
    ).toBe(404);
    expect(
      (await api.send('DELETE', `/api/comments/${c.id}`, w.stranger.cookie))
        .status,
    ).toBe(404);
  });

  it('lets only the author edit, and sets editedAt', async () => {
    const w = await setup();
    const c = await read<Node>(await w.post(w.member.cookie, { body: 'old' }));
    for (const who of [w.owner, w.manager, w.other]) {
      const res = await api.send('PATCH', `/api/comments/${c.id}`, who.cookie, {
        body: 'new',
      });
      expect(res.status).toBe(403);
      expect(await read(res)).toMatchObject({ code: 'forbidden' });
    }
    const empty = await api.send(
      'PATCH',
      `/api/comments/${c.id}`,
      w.member.cookie,
      { body: ' ' },
    );
    expect(await read(empty)).toMatchObject({ code: 'empty_comment' });

    const edited = await read<Node>(
      await api.send('PATCH', `/api/comments/${c.id}`, w.member.cookie, {
        body: 'new',
      }),
    );
    expect(edited.body).toBe('new');
    expect(edited.editedAt).not.toBeNull();
    const [seen] = (await w.tree(w.member.cookie)).comments;
    expect(seen.editedAt).not.toBeNull();
  });

  it('lets the author, a manager or an owner delete, but not another member', async () => {
    const w = await setup();
    const c = await read<Node>(await w.post(w.member.cookie, { body: 'mine' }));
    const denied = await api.send(
      'DELETE',
      `/api/comments/${c.id}`,
      w.other.cookie,
    );
    expect(denied.status).toBe(403);
    expect(await read(denied)).toMatchObject({ code: 'forbidden' });

    const asMember = await w.tree(w.other.cookie);
    expect(asMember.comments[0]).toMatchObject({
      canEdit: false,
      canDelete: false,
    });
    expect((await w.tree(w.manager.cookie)).comments[0].canDelete).toBe(true);

    expect(
      (await api.send('DELETE', `/api/comments/${c.id}`, w.manager.cookie))
        .status,
    ).toBe(200);
    const byOwner = await read<Node>(
      await w.post(w.member.cookie, { body: 'again' }),
    );
    expect(
      (await api.send('DELETE', `/api/comments/${byOwner.id}`, w.owner.cookie))
        .status,
    ).toBe(200);
    const byAuthor = await read<Node>(
      await w.post(w.member.cookie, { body: 'again' }),
    );
    expect(
      (
        await api.send(
          'DELETE',
          `/api/comments/${byAuthor.id}`,
          w.member.cookie,
        )
      ).status,
    ).toBe(200);
  });

  it('leaves a placeholder that keeps the replies, and refuses to touch it again', async () => {
    const w = await setup();
    const parent = await read<Node>(
      await w.post(w.member.cookie, { body: 'parent' }),
    );
    await w.post(w.other.cookie, { body: 'child', parentId: parent.id });
    await api.send('DELETE', `/api/comments/${parent.id}`, w.member.cookie);

    const seen = await w.tree(w.owner.cookie);
    expect(seen.count).toBe(1);
    expect(seen.comments[0]).toMatchObject({
      deleted: true,
      body: '',
      author: null,
      canEdit: false,
      canDelete: false,
    });
    expect(seen.comments[0].replies[0].body).toBe('child');

    const again = await Promise.all([
      api.send('PATCH', `/api/comments/${parent.id}`, w.member.cookie, {
        body: 'x',
      }),
      api.send('DELETE', `/api/comments/${parent.id}`, w.member.cookie),
      w.post(w.member.cookie, { body: 'reply', parentId: parent.id }),
    ]);
    for (const res of again) expect(res.status).toBe(404);
  });

  it('hides the comments of a deleted ticket', async () => {
    const w = await setup();
    const c = await read<Node>(await w.post(w.member.cookie, { body: 'x' }));
    await api.send('DELETE', `/api/items/${w.item.id}`, w.owner.cookie);
    expect(
      (
        await api.send(
          'GET',
          `/api/items/${w.item.id}/comments`,
          w.owner.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await api.send('PATCH', `/api/comments/${c.id}`, w.member.cookie, {
          body: 'y',
        })
      ).status,
    ).toBe(404);
  });

  it('refuses a row with no target or two targets at the database', async () => {
    const w = await setup();
    const row = await prisma.item.findFirstOrThrow({
      where: { id: w.item.id },
    });
    const base = { projectId: row.projectId, body: 'x' };
    await expect(prisma.comment.create({ data: base })).rejects.toThrow();
    const doc = await prisma.document.create({
      data: { projectId: row.projectId, kind: 'REFERENCE', title: 'D' },
    });
    await expect(
      prisma.comment.create({
        data: { ...base, itemId: row.id, documentId: doc.id },
      }),
    ).rejects.toThrow();
  });

  it('comments on documents: lists, replies, edits and deletes through the shared routes', async () => {
    const w = await setup();
    const doc = await read<{ id: string }>(
      await api.send(
        'POST',
        `/api/projects/${w.projectId}/documents`,
        w.owner.cookie,
        { kind: 'REFERENCE', title: 'D' },
      ),
    );
    const path = `/api/documents/${doc.id}/comments`;
    const first = await read<Node>(
      await api.send('POST', path, w.member.cookie, { body: 'Hi' }),
    );
    const reply = await read<Node>(
      await api.send('POST', path, w.owner.cookie, {
        body: 'Yes',
        parentId: first.id,
      }),
    );
    expect(reply.isTargetAuthor).toBe(true);
    const seen = await read<{ count: number; comments: Node[] }>(
      await api.send('GET', path, w.other.cookie),
    );
    expect(seen.count).toBe(2);
    expect(seen.comments[0].replies[0].body).toBe('Yes');

    const edited = await read<Node>(
      await api.send('PATCH', `/api/comments/${reply.id}`, w.owner.cookie, {
        body: 'Yes!',
      }),
    );
    expect(edited).toMatchObject({ isTargetAuthor: true });
    expect(edited.editedAt).not.toBeNull();
    expect(
      (await api.send('DELETE', `/api/comments/${first.id}`, w.manager.cookie))
        .status,
    ).toBe(200);

    const empty = await api.send('POST', path, w.member.cookie, { body: ' ' });
    expect(await read(empty)).toMatchObject({ code: 'empty_comment' });
    expect((await api.send('GET', path, w.stranger.cookie)).status).toBe(404);
  });

  it('refuses a reply whose parent is on another document or a ticket', async () => {
    const w = await setup();
    const make = async (title: string) =>
      (
        await read<{ id: string }>(
          await api.send(
            'POST',
            `/api/projects/${w.projectId}/documents`,
            w.owner.cookie,
            { kind: 'REFERENCE', title },
          ),
        )
      ).id;
    const a = await make('A');
    const b = await make('B');
    const onA = await read<Node>(
      await api.send('POST', `/api/documents/${a}/comments`, w.member.cookie, {
        body: 'x',
      }),
    );
    const onItem = await read<Node>(
      await w.post(w.member.cookie, { body: 'y' }),
    );
    for (const parentId of [onA.id, onItem.id]) {
      const wrongDoc = await api.send(
        'POST',
        `/api/documents/${b}/comments`,
        w.member.cookie,
        { body: 'z', parentId },
      );
      expect(wrongDoc.status).toBe(404);
    }
    const onTicket = await w.post(w.member.cookie, {
      body: 'z',
      parentId: onA.id,
    });
    expect(onTicket.status).toBe(404);
  });

  it('hides the comments of a ticket-owned document once its ticket is deleted', async () => {
    const w = await setup(true);
    const doc = await read<{ id: string }>(
      await api.send(
        'POST',
        `/api/items/${w.item.id}/documents/new`,
        w.owner.cookie,
        { kind: 'REFERENCE', title: 'Owned' },
      ),
    );
    const path = `/api/documents/${doc.id}/comments`;
    const c = await read<Node>(
      await api.send('POST', path, w.member.cookie, { body: 'x' }),
    );
    expect((await api.send('GET', path, w.member.cookie)).status).toBe(200);
    await api.send('DELETE', `/api/items/${w.item.id}`, w.owner.cookie);
    expect((await api.send('GET', path, w.member.cookie)).status).toBe(404);
    expect(
      (await api.send('POST', path, w.member.cookie, { body: 'y' })).status,
    ).toBe(404);
    expect(
      (
        await api.send('PATCH', `/api/comments/${c.id}`, w.member.cookie, {
          body: 'z',
        })
      ).status,
    ).toBe(404);
    expect(
      (await api.send('DELETE', `/api/comments/${c.id}`, w.owner.cookie))
        .status,
    ).toBe(404);
  });
});
