import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Item {
  id: string;
  key: string;
  kind: string;
  state: { id: string; name: string };
  parentId: string | null;
  assigneeId: string | null;
  blockedBy: string[];
}

describe('items (e2e)', () => {
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

  /** A signed-in owner with a new workspace in `mode`. */
  const workspace = async (mode: 'GUIDED' | 'STANDARD') => {
    const owner = await api.signInReady();
    const keyPrefix = freshPrefix();
    const res = await api.send('POST', '/api/workspaces', owner.cookie, {
      name: 'W',
      keyPrefix,
      mode,
    });
    const { id } = (await read(res)) as { id: string };
    const add = async (body: Record<string, unknown>) => {
      const created = await api.send(
        'POST',
        `/api/workspaces/${id}/items`,
        owner.cookie,
        body,
      );
      return {
        status: created.status,
        body: (await read(created)) as Item & { code?: string },
      };
    };
    return { id, keyPrefix, cookie: owner.cookie, add };
  };

  describe('creating', () => {
    it('numbers items per workspace and starts them in the first state', async () => {
      const w = await workspace('GUIDED');
      const first = await w.add({ kind: 'FEATURE', title: 'Sign-in' });
      const second = await w.add({ kind: 'FEATURE', title: 'Board' });

      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        key: `${w.keyPrefix}-1`,
        state: { name: 'Triage' },
      });
      expect(second.body.key).toBe(`${w.keyPrefix}-2`);
    });

    it('gives concurrent creates distinct numbers', async () => {
      const w = await workspace('STANDARD');
      const created = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          w.add({ kind: 'ISSUE', title: `Issue ${i}` }),
        ),
      );
      expect(created.every((c) => c.status === 201)).toBe(true);
      const keys = created.map((c) => c.body.key).sort();
      expect(new Set(keys).size).toBe(10);
    });

    it('enforces Guided kinds: feature → slice only', async () => {
      const w = await workspace('GUIDED');
      const feature = (await w.add({ kind: 'FEATURE', title: 'F' })).body;

      expect(
        (await w.add({ kind: 'SLICE', title: 'S', parentId: feature.id }))
          .status,
      ).toBe(201);
      const orphan = await w.add({ kind: 'SLICE', title: 'S' });
      expect(orphan.status).toBe(400);
      expect(orphan.body.code).toBe('invalid_kind');
      expect((await w.add({ kind: 'ISSUE', title: 'I' })).body.code).toBe(
        'invalid_kind',
      );
    });

    it('enforces Standard kinds: project → issue → sub-issue', async () => {
      const w = await workspace('STANDARD');
      const project = (await w.add({ kind: 'PROJECT', title: 'P' })).body;
      const issue = (
        await w.add({ kind: 'ISSUE', title: 'I', parentId: project.id })
      ).body;

      expect(
        (await w.add({ kind: 'ISSUE', title: 'Loose issue' })).status,
      ).toBe(201);
      expect(
        (await w.add({ kind: 'SUB_ISSUE', title: 'S', parentId: issue.id }))
          .status,
      ).toBe(201);
      expect(
        (await w.add({ kind: 'SUB_ISSUE', title: 'S', parentId: project.id }))
          .body.code,
      ).toBe('invalid_kind');
      expect((await w.add({ kind: 'FEATURE', title: 'F' })).body.code).toBe(
        'invalid_kind',
      );
    });

    it('refuses a parent, state or assignee from elsewhere (400)', async () => {
      const w = await workspace('STANDARD');
      const other = await workspace('STANDARD');
      const foreign = (await other.add({ kind: 'PROJECT', title: 'P' })).body;
      const outsider = await api.signInReady();
      const outsiderId = (await read(
        await api.send('GET', '/api/me', outsider.cookie),
      )) as { id: string };

      expect(
        (await w.add({ kind: 'ISSUE', title: 'I', parentId: foreign.id })).body
          .code,
      ).toBe('invalid_parent');
      expect(
        (await w.add({ kind: 'ISSUE', title: 'I', stateId: foreign.state.id }))
          .body.code,
      ).toBe('invalid_state');
      expect(
        (await w.add({ kind: 'ISSUE', title: 'I', assigneeId: outsiderId.id }))
          .body.code,
      ).toBe('invalid_assignee');
    });
  });

  describe('response shape', () => {
    it('wraps a success in { success, message, data } and an error in { success, statusCode, code, message }', async () => {
      const w = await workspace('GUIDED');
      const created = await api.send(
        'POST',
        `/api/workspaces/${w.id}/items`,
        w.cookie,
        {
          kind: 'FEATURE',
          title: 'Sign-in',
        },
      );
      expect(await created.json()).toEqual({
        success: true,
        message: `${w.keyPrefix}-1 created`,
        data: expect.objectContaining({
          key: `${w.keyPrefix}-1`,
          title: 'Sign-in',
        }),
      });

      const refused = await api.send(
        'POST',
        `/api/workspaces/${w.id}/items`,
        w.cookie,
        { kind: 'SLICE', title: 'S' },
      );
      expect(await refused.json()).toEqual({
        success: false,
        statusCode: 400,
        code: 'invalid_kind',
        message: expect.any(String),
      });
    });

    it('answers an unknown /api route with the error envelope', async () => {
      const w = await workspace('STANDARD');
      const res = await api.send('GET', '/api/nothing-here', w.cookie);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({
        success: false,
        code: 'not_found',
      });
    });
  });

  describe('updating with rules', () => {
    it('moves a slice to another feature, and refuses itself, foreign and wrong-kind parents', async () => {
      const w = await workspace('GUIDED');
      const other = await workspace('GUIDED');
      const f1 = (await w.add({ kind: 'FEATURE', title: 'F1' })).body;
      const f2 = (await w.add({ kind: 'FEATURE', title: 'F2' })).body;
      const slice = (
        await w.add({ kind: 'SLICE', title: 'S', parentId: f1.id })
      ).body;
      const foreign = (await other.add({ kind: 'FEATURE', title: 'X' })).body;
      const patch = async (id: string, body: object) => {
        const res = await api.send('PATCH', `/api/items/${id}`, w.cookie, body);
        return { status: res.status, body: await read(res) };
      };

      expect(await patch(slice.id, { parentId: f2.id })).toMatchObject({
        status: 200,
        body: { parentId: f2.id },
      });
      expect((await patch(slice.id, { parentId: slice.id })).body.code).toBe(
        'invalid_parent',
      );
      expect((await patch(slice.id, { parentId: foreign.id })).body.code).toBe(
        'invalid_parent',
      );
      expect((await patch(slice.id, { parentId: null })).body.code).toBe(
        'invalid_kind',
      );
      expect((await patch(f1.id, { parentId: f2.id })).body.code).toBe(
        'invalid_kind',
      );
    });

    it('refuses a foreign state or a non-member assignee, and can unassign', async () => {
      const w = await workspace('STANDARD');
      const other = await workspace('STANDARD');
      const item = (await w.add({ kind: 'ISSUE', title: 'I' })).body;
      const foreign = (await other.add({ kind: 'ISSUE', title: 'X' })).body;
      const outsider = await api.signInReady();
      const outsiderId = (
        await read(await api.send('GET', '/api/me', outsider.cookie))
      ).id;
      const me = (await read(await api.send('GET', '/api/me', w.cookie))).id;
      const patch = async (body: object) =>
        read(await api.send('PATCH', `/api/items/${item.id}`, w.cookie, body));

      expect((await patch({ stateId: foreign.state.id })).code).toBe(
        'invalid_state',
      );
      expect((await patch({ assigneeId: outsiderId })).code).toBe(
        'invalid_assignee',
      );
      expect((await patch({ assigneeId: me })).assigneeId).toBe(me);
      expect((await patch({ assigneeId: null })).assigneeId).toBeNull();
    });
  });

  describe('updating and deleting', () => {
    it('moves an item to another state and assigns it', async () => {
      const w = await workspace('STANDARD');
      const item = (await w.add({ kind: 'ISSUE', title: 'I' })).body;
      const states = await prisma.state.findMany({
        where: { workspaceId: w.id },
        orderBy: { position: 'asc' },
      });
      const me = (await read(await api.send('GET', '/api/me', w.cookie))) as {
        id: string;
      };

      const res = await api.send('PATCH', `/api/items/${item.id}`, w.cookie, {
        stateId: states[1].id,
        assigneeId: me.id,
        title: 'Renamed',
      });
      expect(res.status).toBe(200);
      expect(await read(res)).toMatchObject({
        title: 'Renamed',
        state: { name: 'In Progress' },
        assigneeId: me.id,
      });
    });

    it('refuses to delete an item that has children (409), then deletes once they are gone', async () => {
      const w = await workspace('GUIDED');
      const feature = (await w.add({ kind: 'FEATURE', title: 'F' })).body;
      const slice = (
        await w.add({ kind: 'SLICE', title: 'S', parentId: feature.id })
      ).body;

      const blocked = await api.send(
        'DELETE',
        `/api/items/${feature.id}`,
        w.cookie,
      );
      expect(blocked.status).toBe(409);
      expect(await read(blocked)).toMatchObject({ code: 'has_children' });

      expect(
        (await api.send('DELETE', `/api/items/${slice.id}`, w.cookie)).status,
      ).toBe(200);
      expect(
        (await api.send('DELETE', `/api/items/${feature.id}`, w.cookie)).status,
      ).toBe(200);
      expect(
        (await api.send('GET', `/api/items/${feature.id}`, w.cookie)).status,
      ).toBe(404);
    });
  });

  describe('soft delete', () => {
    it('hides a deleted item everywhere but keeps its row', async () => {
      const w = await workspace('STANDARD');
      const project = (await w.add({ kind: 'PROJECT', title: 'P' })).body;
      const gone = (
        await w.add({ kind: 'ISSUE', title: 'Gone', parentId: project.id })
      ).body;
      const other = (await w.add({ kind: 'ISSUE', title: 'Other' })).body;
      await api.send('POST', `/api/items/${other.id}/blockers`, w.cookie, {
        blockerId: gone.id,
      });

      const deleted = await api.send(
        'DELETE',
        `/api/items/${gone.id}`,
        w.cookie,
      );
      expect(deleted.status).toBe(200);
      expect(await read(deleted)).toBeNull();

      // Gone from the API…
      expect(
        (await api.send('GET', `/api/items/${gone.id}`, w.cookie)).status,
      ).toBe(404);
      const rows = await read(
        await api.send('GET', `/api/workspaces/${w.id}/items`, w.cookie),
      );
      expect(rows.map((r: { id: string }) => r.id)).not.toContain(gone.id);
      expect(
        (await read(await api.send('GET', `/api/items/${other.id}`, w.cookie)))
          .blockedBy,
      ).toEqual([]);
      expect(
        (await w.add({ kind: 'SUB_ISSUE', title: 'S', parentId: gone.id })).body
          .code,
      ).toBe('invalid_parent');
      // …its parent can now be deleted, and its number is never reused…
      expect(
        (await api.send('DELETE', `/api/items/${project.id}`, w.cookie)).status,
      ).toBe(200);
      expect((await w.add({ kind: 'ISSUE', title: 'Next' })).body.key).toBe(
        `${w.keyPrefix}-4`,
      );
      // …but the row is still in the database.
      expect(
        await prisma.item.findUniqueOrThrow({ where: { id: gone.id } }),
      ).toMatchObject({
        title: 'Gone',
        deletedAt: expect.any(Date),
      });
    });
  });

  describe('restore', () => {
    it('lists deleted items in the trash and brings one back with its key', async () => {
      const w = await workspace('GUIDED');
      const feature = (await w.add({ kind: 'FEATURE', title: 'F' })).body;
      const slice = (
        await w.add({ kind: 'SLICE', title: 'S', parentId: feature.id })
      ).body;
      await api.send('DELETE', `/api/items/${slice.id}`, w.cookie);

      const trash = await read(
        await api.send(
          'GET',
          `/api/workspaces/${w.id}/items/deleted`,
          w.cookie,
        ),
      );
      expect(trash).toEqual([
        expect.objectContaining({
          id: slice.id,
          key: slice.key,
          deletedAt: expect.any(String),
        }),
      ]);

      const restored = await api.send(
        'POST',
        `/api/items/${slice.id}/restore`,
        w.cookie,
      );
      expect(restored.status).toBe(200);
      expect(await read(restored)).toMatchObject({
        id: slice.id,
        key: slice.key,
        parentId: feature.id,
      });
      expect(
        (await api.send('GET', `/api/items/${slice.id}`, w.cookie)).status,
      ).toBe(200);
      expect(
        await read(
          await api.send(
            'GET',
            `/api/workspaces/${w.id}/items/deleted`,
            w.cookie,
          ),
        ),
      ).toEqual([]);
    });

    it('asks to restore a deleted parent first (409), and 404s an item that is not deleted', async () => {
      const w = await workspace('GUIDED');
      const feature = (await w.add({ kind: 'FEATURE', title: 'F' })).body;
      const slice = (
        await w.add({ kind: 'SLICE', title: 'S', parentId: feature.id })
      ).body;
      await api.send('DELETE', `/api/items/${slice.id}`, w.cookie);
      await api.send('DELETE', `/api/items/${feature.id}`, w.cookie);

      const early = await api.send(
        'POST',
        `/api/items/${slice.id}/restore`,
        w.cookie,
      );
      expect(early.status).toBe(409);
      expect(await read(early)).toMatchObject({ code: 'parent_deleted' });

      expect(
        (await api.send('POST', `/api/items/${feature.id}/restore`, w.cookie))
          .status,
      ).toBe(200);
      expect(
        (await api.send('POST', `/api/items/${slice.id}/restore`, w.cookie))
          .status,
      ).toBe(200);
      expect(
        (await api.send('POST', `/api/items/${slice.id}/restore`, w.cookie))
          .status,
      ).toBe(404);
    });
  });

  describe('blocked-by', () => {
    it('links, lists and unlinks', async () => {
      const w = await workspace('STANDARD');
      const a = (await w.add({ kind: 'ISSUE', title: 'A' })).body;
      const b = (await w.add({ kind: 'ISSUE', title: 'B' })).body;

      const linked = await api.send(
        'POST',
        `/api/items/${a.id}/blockers`,
        w.cookie,
        { blockerId: b.id },
      );
      expect(linked.status).toBe(201);
      expect(((await read(linked)) as Item).blockedBy).toEqual([b.id]);

      expect(
        (
          await api.send(
            'DELETE',
            `/api/items/${a.id}/blockers/${b.id}`,
            w.cookie,
          )
        ).status,
      ).toBe(200);
      const after = (await read(
        await api.send('GET', `/api/items/${a.id}`, w.cookie),
      )) as Item;
      expect(after.blockedBy).toEqual([]);
    });

    it('lets only one of two opposite links sent at the same time through', async () => {
      const w = await workspace('STANDARD');
      const a = (await w.add({ kind: 'ISSUE', title: 'A' })).body;
      const b = (await w.add({ kind: 'ISSUE', title: 'B' })).body;
      const results = await Promise.all([
        api.send('POST', `/api/items/${a.id}/blockers`, w.cookie, {
          blockerId: b.id,
        }),
        api.send('POST', `/api/items/${b.id}/blockers`, w.cookie, {
          blockerId: a.id,
        }),
      ]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        201, 409,
      ]);
      expect(
        await prisma.itemBlock.count({
          where: { blockedId: { in: [a.id, b.id] } },
        }),
      ).toBe(1);
    });

    it('answers two identical links sent at the same time with 201 and 409, never 500', async () => {
      const w = await workspace('STANDARD');
      const a = (await w.add({ kind: 'ISSUE', title: 'A' })).body;
      const b = (await w.add({ kind: 'ISSUE', title: 'B' })).body;
      const link = () =>
        api.send('POST', `/api/items/${a.id}/blockers`, w.cookie, {
          blockerId: b.id,
        });
      const results = await Promise.all([link(), link()]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        201, 409,
      ]);
    });

    it('refuses self (400), duplicates (409) and cycles (409)', async () => {
      const w = await workspace('STANDARD');
      const [a, b, c] = await Promise.all(
        ['A', 'B', 'C'].map(
          async (t) => (await w.add({ kind: 'ISSUE', title: t })).body,
        ),
      );
      const block = async (item: Item, blocker: Item) => {
        const res = await api.send(
          'POST',
          `/api/items/${item.id}/blockers`,
          w.cookie,
          { blockerId: blocker.id },
        );
        return {
          status: res.status,
          code: ((await read(res)) as { code?: string }).code,
        };
      };

      expect(await block(a, a)).toEqual({ status: 400, code: 'self_block' });
      expect((await block(a, b)).status).toBe(201);
      expect(await block(a, b)).toEqual({
        status: 409,
        code: 'already_blocked',
      });
      expect(await block(b, a)).toEqual({
        status: 409,
        code: 'blocking_cycle',
      });
      expect((await block(b, c)).status).toBe(201);
      expect(await block(c, a)).toEqual({
        status: 409,
        code: 'blocking_cycle',
      });
    });
  });

  it('answers 404 to someone outside the workspace, on every route', async () => {
    const w = await workspace('STANDARD');
    const item = (await w.add({ kind: 'ISSUE', title: 'I' })).body;
    const outsider = await api.signInReady();

    const responses = await Promise.all([
      api.send('GET', `/api/workspaces/${w.id}/items`, outsider.cookie),
      api.send('POST', `/api/workspaces/${w.id}/items`, outsider.cookie, {
        kind: 'ISSUE',
        title: 'X',
      }),
      api.send('GET', `/api/items/${item.id}`, outsider.cookie),
      api.send('PATCH', `/api/items/${item.id}`, outsider.cookie, {
        title: 'X',
      }),
      api.send('DELETE', `/api/items/${item.id}`, outsider.cookie),
      api.send('POST', `/api/items/${item.id}/blockers`, outsider.cookie, {
        blockerId: item.id,
      }),
      api.send(
        'DELETE',
        `/api/items/${item.id}/blockers/${item.id}`,
        outsider.cookie,
      ),
      api.send('GET', `/api/workspaces/${w.id}/items/deleted`, outsider.cookie),
      api.send('POST', `/api/items/${item.id}/restore`, outsider.cookie),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(9).fill(404));
    expect(
      (await api.send('GET', `/api/items/not-a-uuid`, outsider.cookie)).status,
    ).toBe(404);
  });

  it('lists slim rows for members', async () => {
    const w = await workspace('GUIDED');
    await w.add({ kind: 'FEATURE', title: 'Sign-in' });
    const rows = (await read(
      await api.send('GET', `/api/workspaces/${w.id}/items`, w.cookie),
    )) as object[];
    expect(rows).toEqual([
      {
        id: expect.any(String),
        key: `${w.keyPrefix}-1`,
        kind: 'FEATURE',
        title: 'Sign-in',
        state: { id: expect.any(String), name: 'Triage' },
        priority: 'NONE',
        assigneeId: null,
        parentId: null,
      },
    ]);
  });
});
