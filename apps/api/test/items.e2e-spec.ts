import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Entry {
  id: string;
  text: string;
  done: boolean;
  evidence: string | null;
  position: number;
}

interface Item {
  id: string;
  key: string;
  kind: string;
  state: { id: string; name: string };
  parentId: string | null;
  assigneeId: string | null;
  blockedBy: string[];
  checklist: Entry[];
}

describe('items (e2e)', () => {
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

  /** A signed-in owner with a new project in `mode`. */
  const project = async (mode: 'GUIDED' | 'STANDARD') => {
    const owner = await api.signInReady();
    const keyPrefix = freshPrefix();
    const res = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'W',
      keyPrefix,
      mode,
    });
    const { id } = (await read(res)) as { id: string };
    const add = async (body: Record<string, unknown>) => {
      const created = await api.send(
        'POST',
        `/api/projects/${id}/items`,
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
    it('numbers items per project and starts them in the first state', async () => {
      const w = await project('GUIDED');
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
      const w = await project('STANDARD');
      const created = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          w.add({ kind: 'TASK', title: `Task ${i}` }),
        ),
      );
      expect(created.every((c) => c.status === 201)).toBe(true);
      const keys = created.map((c) => c.body.key).sort();
      expect(new Set(keys).size).toBe(10);
    });

    it('enforces Guided kinds: feature → slice only', async () => {
      const w = await project('GUIDED');
      const feature = (await w.add({ kind: 'FEATURE', title: 'F' })).body;

      expect(
        (await w.add({ kind: 'SLICE', title: 'S', parentId: feature.id }))
          .status,
      ).toBe(201);
      const orphan = await w.add({ kind: 'SLICE', title: 'S' });
      expect(orphan.status).toBe(400);
      expect(orphan.body.code).toBe('invalid_kind');
      expect((await w.add({ kind: 'TASK', title: 'I' })).body.code).toBe(
        'invalid_kind',
      );
    });

    it('enforces Standard kinds: task → subtask', async () => {
      const w = await project('STANDARD');
      const task = (await w.add({ kind: 'TASK', title: 'T' })).body;
      const subtask = (
        await w.add({ kind: 'SUBTASK', title: 'S', parentId: task.id })
      ).body;

      expect(subtask.parentId).toBe(task.id);
      expect((await w.add({ kind: 'SUBTASK', title: 'S' })).body.code).toBe(
        'invalid_kind',
      );
      expect(
        (await w.add({ kind: 'TASK', title: 'T', parentId: task.id })).body
          .code,
      ).toBe('invalid_kind');
      expect(
        (await w.add({ kind: 'SUBTASK', title: 'S', parentId: subtask.id }))
          .body.code,
      ).toBe('invalid_kind');
      expect((await w.add({ kind: 'FEATURE', title: 'F' })).body.code).toBe(
        'invalid_kind',
      );
    });

    it('refuses the removed PROJECT kind (400)', async () => {
      const w = await project('STANDARD');
      const res = await w.add({ kind: 'PROJECT', title: 'P' });
      expect(res.status).toBe(400);
    });

    it('refuses a parent, state or assignee from elsewhere (400)', async () => {
      const w = await project('STANDARD');
      const other = await project('STANDARD');
      const foreign = (await other.add({ kind: 'TASK', title: 'T' })).body;
      const outsider = await api.signInReady();
      const outsiderId = (await read(
        await api.send('GET', '/api/me', outsider.cookie),
      )) as { id: string };

      expect(
        (await w.add({ kind: 'TASK', title: 'I', parentId: foreign.id })).body
          .code,
      ).toBe('invalid_parent');
      expect(
        (await w.add({ kind: 'TASK', title: 'I', stateId: foreign.state.id }))
          .body.code,
      ).toBe('invalid_state');
      expect(
        (await w.add({ kind: 'TASK', title: 'I', assigneeId: outsiderId.id }))
          .body.code,
      ).toBe('invalid_assignee');
    });
  });

  describe('response shape', () => {
    it('wraps a success in { success, message, data } and an error in { success, statusCode, code, message }', async () => {
      const w = await project('GUIDED');
      const created = await api.send(
        'POST',
        `/api/projects/${w.id}/items`,
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
        `/api/projects/${w.id}/items`,
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
      const w = await project('STANDARD');
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
      const w = await project('GUIDED');
      const other = await project('GUIDED');
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
      const w = await project('STANDARD');
      const other = await project('STANDARD');
      const item = (await w.add({ kind: 'TASK', title: 'I' })).body;
      const foreign = (await other.add({ kind: 'TASK', title: 'X' })).body;
      const outsider = await api.signInReady();
      const outsiderId = (
        await read(await api.send('GET', '/api/me', outsider.cookie))
      ).id;
      const me = (await read(await api.send('GET', '/api/me', w.cookie))).id;
      const patch = async (body: object) =>
        read(await api.send('PATCH', `/api/items/${item.id}`, w.cookie, body));

      expect(
        (
          await read(
            await api.send('POST', `/api/items/${item.id}/move`, w.cookie, {
              stateId: foreign.state.id,
            }),
          )
        ).code,
      ).toBe('invalid_state');
      expect((await patch({ assigneeId: outsiderId })).code).toBe(
        'invalid_assignee',
      );
      expect((await patch({ assigneeId: me })).assigneeId).toBe(me);
      expect((await patch({ assigneeId: null })).assigneeId).toBeNull();
    });
  });

  describe('updating and deleting', () => {
    it('moves an item to another state and assigns it', async () => {
      const w = await project('STANDARD');
      const item = (await w.add({ kind: 'TASK', title: 'I' })).body;
      const states = await prisma.state.findMany({
        where: { projectId: w.id },
        orderBy: { position: 'asc' },
      });
      const me = (await read(await api.send('GET', '/api/me', w.cookie))) as {
        id: string;
      };

      const edited = await api.send(
        'PATCH',
        `/api/items/${item.id}`,
        w.cookie,
        {
          assigneeId: me.id,
          title: 'Renamed',
        },
      );
      expect(edited.status).toBe(200);
      const res = await api.send(
        'POST',
        `/api/items/${item.id}/move`,
        w.cookie,
        {
          stateId: states[1].id,
        },
      );
      expect(res.status).toBe(200);
      expect(await read(res)).toMatchObject({
        title: 'Renamed',
        state: { name: 'In Progress' },
        assigneeId: me.id,
      });
    });

    it('ignores stateId on PATCH: only /move changes the state', async () => {
      const w = await project('STANDARD');
      const item = (await w.add({ kind: 'TASK', title: 'I' })).body;
      const states = await prisma.state.findMany({
        where: { projectId: w.id },
        orderBy: { position: 'asc' },
      });
      const res = await api.send('PATCH', `/api/items/${item.id}`, w.cookie, {
        stateId: states[1].id,
        title: 'Renamed',
      });
      expect(res.status).toBe(200);
      expect(await read(res)).toMatchObject({
        title: 'Renamed',
        state: { id: item.state.id },
      });
    });

    it('refuses to delete an item that has children (409), then deletes once they are gone', async () => {
      const w = await project('GUIDED');
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
      const w = await project('STANDARD');
      const parent = (await w.add({ kind: 'TASK', title: 'Parent' })).body;
      const gone = (
        await w.add({ kind: 'SUBTASK', title: 'Gone', parentId: parent.id })
      ).body;
      const other = (await w.add({ kind: 'TASK', title: 'Other' })).body;
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
        await api.send('GET', `/api/projects/${w.id}/items`, w.cookie),
      );
      expect(rows.map((r: { id: string }) => r.id)).not.toContain(gone.id);
      expect(
        (await read(await api.send('GET', `/api/items/${other.id}`, w.cookie)))
          .blockedBy,
      ).toEqual([]);
      expect(
        (await w.add({ kind: 'SUBTASK', title: 'S', parentId: gone.id })).body
          .code,
      ).toBe('invalid_parent');
      // …its parent can now be deleted, and its number is never reused…
      expect(
        (await api.send('DELETE', `/api/items/${parent.id}`, w.cookie)).status,
      ).toBe(200);
      expect((await w.add({ kind: 'TASK', title: 'Next' })).body.key).toBe(
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
      const w = await project('GUIDED');
      const feature = (await w.add({ kind: 'FEATURE', title: 'F' })).body;
      const slice = (
        await w.add({ kind: 'SLICE', title: 'S', parentId: feature.id })
      ).body;
      await api.send('DELETE', `/api/items/${slice.id}`, w.cookie);

      const trash = await read(
        await api.send('GET', `/api/projects/${w.id}/items/deleted`, w.cookie),
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
            `/api/projects/${w.id}/items/deleted`,
            w.cookie,
          ),
        ),
      ).toEqual([]);
    });

    it('asks to restore a deleted parent first (409), and 404s an item that is not deleted', async () => {
      const w = await project('GUIDED');
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
      const w = await project('STANDARD');
      const a = (await w.add({ kind: 'TASK', title: 'A' })).body;
      const b = (await w.add({ kind: 'TASK', title: 'B' })).body;

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
      const w = await project('STANDARD');
      const a = (await w.add({ kind: 'TASK', title: 'A' })).body;
      const b = (await w.add({ kind: 'TASK', title: 'B' })).body;
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
      const w = await project('STANDARD');
      const a = (await w.add({ kind: 'TASK', title: 'A' })).body;
      const b = (await w.add({ kind: 'TASK', title: 'B' })).body;
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
      const w = await project('STANDARD');
      const [a, b, c] = await Promise.all(
        ['A', 'B', 'C'].map(
          async (t) => (await w.add({ kind: 'TASK', title: t })).body,
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

  describe('roles', () => {
    /** A project with an item, and a manager and a member joined as the owner. */
    const withRoles = async () => {
      const w = await project('STANDARD');
      const item = (await w.add({ kind: 'TASK', title: 'T' })).body;
      const join = async (role: string) => {
        const p = await api.signInReady();
        const res = await api.send(
          'POST',
          `/api/projects/${w.id}/members`,
          w.cookie,
          { email: p.profile.email, role },
        );
        expect(res.status).toBe(201);
        return p.cookie;
      };
      return {
        w,
        item,
        manager: await join('MANAGER'),
        member: await join('MEMBER'),
      };
    };

    it('lets a manager create, delete and restore; a member gets 403 on each', async () => {
      const { w, item, manager, member } = await withRoles();
      const create = (cookie: string) =>
        api.send('POST', `/api/projects/${w.id}/items`, cookie, {
          kind: 'SUBTASK',
          title: 'S',
          parentId: item.id,
        });

      const denied = await create(member);
      expect(denied.status).toBe(403);
      expect(await read(denied)).toMatchObject({ code: 'forbidden' });
      const made = await create(manager);
      expect(made.status).toBe(201);
      const { id } = (await read(made)) as Item;

      const noDelete = await api.send('DELETE', `/api/items/${id}`, member);
      expect(noDelete.status).toBe(403);
      expect(await read(noDelete)).toMatchObject({ code: 'forbidden' });
      expect(
        (await api.send('DELETE', `/api/items/${id}`, manager)).status,
      ).toBe(200);

      const noRestore = await api.send(
        'POST',
        `/api/items/${id}/restore`,
        member,
      );
      expect(noRestore.status).toBe(403);
      expect(await read(noRestore)).toMatchObject({ code: 'forbidden' });
      expect(
        (await api.send('POST', `/api/items/${id}/restore`, manager)).status,
      ).toBe(200);
    });

    it('still lets a member edit fields, claim and set blockers', async () => {
      const { w, item, manager, member } = await withRoles();
      const other = (
        (await read(
          await api.send('POST', `/api/projects/${w.id}/items`, manager, {
            kind: 'TASK',
            title: 'O',
          }),
        )) as Item
      ).id;
      const memberId = (
        (await read(await api.send('GET', '/api/me', member))) as Item
      ).id;

      // Members edit fields freely and can claim; moving is covered under 'moving'.
      const moved = await api.send('PATCH', `/api/items/${item.id}`, member, {
        title: 'Renamed',
        assigneeId: memberId,
      });
      expect(moved.status).toBe(200);
      expect(await read(moved)).toMatchObject({ title: 'Renamed' });
      expect(
        (
          await api.send('POST', `/api/items/${item.id}/blockers`, member, {
            blockerId: other,
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await api.send(
            'DELETE',
            `/api/items/${item.id}/blockers/${other}`,
            member,
          )
        ).status,
      ).toBe(200);
    });

    it('lets owners and managers assign anyone, and a member only claim or unclaim', async () => {
      const { w, item, manager, member } = await withRoles();
      const me = async (cookie: string) =>
        ((await read(await api.send('GET', '/api/me', cookie))) as Item).id;
      const ownerId = await me(w.cookie);
      const managerId = await me(manager);
      const memberId = await me(member);
      const set = async (cookie: string, assigneeId: string | null) => {
        const res = await api.send('PATCH', `/api/items/${item.id}`, cookie, {
          assigneeId,
        });
        return {
          status: res.status,
          body: (await read(res)) as Item & { code?: string },
        };
      };

      // Member: can't assign someone else, can claim a free ticket
      expect(await set(member, managerId)).toMatchObject({
        status: 403,
        body: { code: 'forbidden' },
      });
      expect(await set(member, memberId)).toMatchObject({
        status: 200,
        body: { assigneeId: memberId },
      });
      // Member: can unclaim their own
      expect(await set(member, null)).toMatchObject({
        status: 200,
        body: { assigneeId: null },
      });
      // Manager assigns an Owner; a member can't take it or unassign it
      expect(await set(manager, ownerId)).toMatchObject({
        status: 200,
        body: { assigneeId: ownerId },
      });
      expect((await set(member, memberId)).status).toBe(403);
      expect((await set(member, null)).status).toBe(403);
      // Owner reassigns and unassigns
      expect(await set(w.cookie, managerId)).toMatchObject({
        status: 200,
        body: { assigneeId: managerId },
      });
      expect(await set(w.cookie, null)).toMatchObject({
        status: 200,
        body: { assigneeId: null },
      });
      // Same assignee again is no change, so a member's other edits still work
      expect(
        (
          await api.send('PATCH', `/api/items/${item.id}`, member, {
            title: 'Same',
            assigneeId: null,
          })
        ).status,
      ).toBe(200);
      // A non-member is still invalid_assignee for an owner
      const outsider = await api.signInReady();
      expect((await set(w.cookie, await me(outsider.cookie))).body.code).toBe(
        'invalid_assignee',
      );
    });
  });

  describe('moving', () => {
    /** A Guided project with a feature, a slice, an owner, a manager and a member. */
    const withSlice = async () => {
      const w = await project('GUIDED');
      const feature = (await w.add({ kind: 'FEATURE', title: 'F' })).body;
      const slice = (
        await w.add({ kind: 'SLICE', title: 'S', parentId: feature.id })
      ).body;
      const join = async (role: string) => {
        const p = await api.signInReady();
        const res = await api.send(
          'POST',
          `/api/projects/${w.id}/members`,
          w.cookie,
          { email: p.profile.email, role },
        );
        expect(res.status).toBe(201);
        const me = (await read(await api.send('GET', '/api/me', p.cookie))) as {
          id: string;
        };
        return { cookie: p.cookie, id: me.id };
      };
      const states = await prisma.state.findMany({
        where: { projectId: w.id },
      });
      const state = (name: string) => states.find((s) => s.name === name)!.id;
      const move = async (cookie: string, id: string, name: string) => {
        const res = await api.send('POST', `/api/items/${id}/move`, cookie, {
          stateId: state(name),
        });
        return {
          status: res.status,
          body: (await read(res)) as Item & { code?: string; message?: string },
        };
      };
      const tick = async (id: string, texts: string[], done: boolean) => {
        for (const text of texts) {
          const entry = (await read(
            await api.send('POST', `/api/items/${id}/checklist`, w.cookie, {
              text,
            }),
          )) as Entry;
          if (done)
            await api.send(
              'PATCH',
              `/api/items/${id}/checklist/${entry.id}`,
              w.cookie,
              { done: true },
            );
        }
      };
      const assign = (id: string, assigneeId: string | null) =>
        api.send('PATCH', `/api/items/${id}`, w.cookie, { assigneeId });
      return {
        w,
        feature,
        slice,
        manager: await join('MANAGER'),
        member: await join('MEMBER'),
        move,
        tick,
        assign,
        state,
      };
    };

    it('lets a member move only a ticket assigned to them, and reports canMove', async () => {
      const { w, slice, member, manager, move, assign } = await withSlice();
      const canMove = async (cookie: string) =>
        (
          (await read(
            await api.send('GET', `/api/items/${slice.id}`, cookie),
          )) as Item & { canMove: boolean }
        ).canMove;
      const rowCanMove = async (cookie: string) =>
        (
          (await read(
            await api.send('GET', `/api/projects/${w.id}/items`, cookie),
          )) as (Item & { canMove: boolean })[]
        ).find((row) => row.id === slice.id)!.canMove;

      // Unassigned: members can't, owners and managers can.
      expect((await move(member.cookie, slice.id, 'Ready')).status).toBe(403);
      expect(await canMove(member.cookie)).toBe(false);
      expect(await rowCanMove(member.cookie)).toBe(false);
      expect(await canMove(manager.cookie)).toBe(true);
      expect(await canMove(w.cookie)).toBe(true);
      // Someone else's.
      await assign(slice.id, manager.id);
      const denied = await move(member.cookie, slice.id, 'Ready');
      expect(denied).toMatchObject({
        status: 403,
        body: { code: 'forbidden' },
      });
      // Their own, after claiming.
      await assign(slice.id, null);
      expect(
        (
          await api.send('PATCH', `/api/items/${slice.id}`, member.cookie, {
            assigneeId: member.id,
          })
        ).status,
      ).toBe(200);
      expect(await canMove(member.cookie)).toBe(true);
      expect(await rowCanMove(member.cookie)).toBe(true);
      expect((await move(member.cookie, slice.id, 'Ready')).status).toBe(200);
      // Owners and managers move anyone's.
      expect((await move(manager.cookie, slice.id, 'Aligning')).status).toBe(
        200,
      );
      expect((await move(w.cookie, slice.id, 'Backlog')).status).toBe(200);
    });

    it('lets only owners and managers move to Done, with a complete checklist', async () => {
      const { w, slice, member, manager, move, assign, tick } =
        await withSlice();
      await tick(slice.id, ['a', 'b', 'c'], true);
      await assign(slice.id, member.id);
      const denied = await move(member.cookie, slice.id, 'Done');
      expect(denied).toMatchObject({
        status: 403,
        body: { code: 'forbidden' },
      });
      expect((await move(member.cookie, slice.id, 'In Review')).status).toBe(
        200,
      );
      expect((await move(manager.cookie, slice.id, 'Done')).status).toBe(200);
      expect((await move(w.cookie, slice.id, 'In Progress')).status).toBe(200);
      expect((await move(w.cookie, slice.id, 'Done')).status).toBe(200);

      const detail = async (cookie: string) =>
        (await read(
          await api.send('GET', `/api/projects/${w.id}`, cookie),
        )) as { canMoveToDone: boolean };
      expect((await detail(w.cookie)).canMoveToDone).toBe(true);
      expect((await detail(manager.cookie)).canMoveToDone).toBe(true);
      expect((await detail(member.cookie)).canMoveToDone).toBe(false);
    });

    it('refuses In Review and Done with too few or unticked entries (409), naming them', async () => {
      const { slice, manager, move, tick } = await withSlice();
      // No entries: too few.
      const none = await move(manager.cookie, slice.id, 'In Review');
      expect(none).toMatchObject({
        status: 409,
        body: { code: 'criteria_incomplete' },
      });
      expect(none.body.message).toContain('at least 3');
      // Three entries, two unticked.
      await tick(slice.id, ['Ticked one'], true);
      await tick(slice.id, ['Open one', 'Open two'], false);
      const open = await move(manager.cookie, slice.id, 'Done');
      expect(open).toMatchObject({
        status: 409,
        body: { code: 'criteria_incomplete' },
      });
      expect(open.body.message).toContain('"Open one"');
      expect(open.body.message).toContain('"Open two"');
      expect(open.body.message).not.toContain('Ticked one');
      // Other columns are free.
      expect((await move(manager.cookie, slice.id, 'In Progress')).status).toBe(
        200,
      );
      expect((await move(manager.cookie, slice.id, 'Canceled')).status).toBe(
        200,
      );
    });

    it('refuses an entry past checklistMax (409)', async () => {
      const { slice, w, tick } = await withSlice();
      await tick(slice.id, ['1', '2', '3', '4', '5', '6'], false);
      const res = await api.send(
        'POST',
        `/api/items/${slice.id}/checklist`,
        w.cookie,
        { text: '7' },
      );
      expect(res.status).toBe(409);
      expect(await read(res)).toMatchObject({
        code: 'checklist_max_exceeded',
      });
    });

    it('moves the feature to Done when its last open slice is Done or Canceled', async () => {
      const { w, feature, slice, move, tick } = await withSlice();
      const other = (
        await w.add({ kind: 'SLICE', title: 'S2', parentId: feature.id })
      ).body;
      const featureState = async () =>
        (
          (await read(
            await api.send('GET', `/api/items/${feature.id}`, w.cookie),
          )) as Item
        ).state.name;
      await tick(slice.id, ['a', 'b', 'c'], true);

      await move(w.cookie, slice.id, 'Done');
      expect(await featureState()).toBe('Triage');
      await move(w.cookie, other.id, 'Canceled');
      expect(await featureState()).toBe('Done');
    });

    it("gates a feature on its own entries: it stays open, and can't be moved, until they're ticked", async () => {
      const { w, feature, slice, move, tick } = await withSlice();
      await tick(feature.id, ['Overview agreed'], false);
      await tick(slice.id, ['a', 'b', 'c'], true);

      await move(w.cookie, slice.id, 'Done');
      const after = (await read(
        await api.send('GET', `/api/items/${feature.id}`, w.cookie),
      )) as Item;
      expect(after.state.name).toBe('Triage');

      const refused = await move(w.cookie, feature.id, 'Done');
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('criteria_incomplete');
      expect(refused.body.message).toContain('"Overview agreed"');
    });

    it('lets a feature with no entries into Done (no minimum above slices)', async () => {
      const { w, feature, move } = await withSlice();
      expect((await move(w.cookie, feature.id, 'Done')).status).toBe(200);
    });
  });

  describe('checklist', () => {
    /** A project with a task and a member who joined as the owner. */
    const withTask = async () => {
      const w = await project('STANDARD');
      const item = (await w.add({ kind: 'TASK', title: 'T' })).body;
      const joined = await api.signInReady();
      const invited = await api.send(
        'POST',
        `/api/projects/${w.id}/members`,
        w.cookie,
        { email: joined.profile.email, role: 'MEMBER' },
      );
      expect(invited.status).toBe(201);
      const url = `/api/items/${item.id}/checklist`;
      const add = async (text: string, cookie = w.cookie) =>
        (await read(await api.send('POST', url, cookie, { text }))) as Entry;
      const list = async () =>
        (
          (await read(
            await api.send('GET', `/api/items/${item.id}`, w.cookie),
          )) as Item
        ).checklist;
      return { w, item, url, add, list, member: joined.cookie };
    };

    it('adds entries at the end, for any member, and returns them with the item', async () => {
      const { w, url, add, list, member } = await withTask();
      const res = await api.send('POST', url, w.cookie, { text: '  First  ' });
      expect(res.status).toBe(201);
      expect(await read(res)).toEqual({
        id: expect.any(String),
        text: 'First',
        done: false,
        evidence: null,
        position: 0,
      });
      await add('Second', member);
      expect((await list()).map((e) => [e.text, e.position])).toEqual([
        ['First', 0],
        ['Second', 1],
      ]);
    });

    it('gives two adds at the same time different positions', async () => {
      const { w, url, list } = await withTask();
      const results = await Promise.all([
        api.send('POST', url, w.cookie, { text: 'A' }),
        api.send('POST', url, w.cookie, { text: 'B' }),
        api.send('POST', url, w.cookie, { text: 'C' }),
      ]);
      expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
      expect((await list()).map((e) => e.position)).toEqual([0, 1, 2]);
    });

    it('ticks with evidence, keeps the evidence on untick, and clears it when empty', async () => {
      const { w, url, add, list } = await withTask();
      const entry = await add('Tests pass');
      const patch = (body: object) =>
        api.send('PATCH', `${url}/${entry.id}`, w.cookie, body);

      expect(
        await read(await patch({ done: true, evidence: 'a1b2c3d' })),
      ).toMatchObject({
        done: true,
        evidence: 'a1b2c3d',
      });
      expect(await read(await patch({ done: false }))).toMatchObject({
        done: false,
        evidence: 'a1b2c3d',
      });
      expect(
        await read(await patch({ text: 'Tests pass in CI' })),
      ).toMatchObject({
        text: 'Tests pass in CI',
        evidence: 'a1b2c3d',
      });
      expect(await read(await patch({ evidence: '' }))).toMatchObject({
        evidence: null,
      });
      expect((await list())[0].text).toBe('Tests pass in CI');
    });

    it('refuses empty text with 400', async () => {
      const { w, url, add } = await withTask();
      const entry = await add('X');
      for (const text of ['', '   '])
        expect((await api.send('POST', url, w.cookie, { text })).status).toBe(
          400,
        );
      expect(
        (await api.send('PATCH', `${url}/${entry.id}`, w.cookie, { text: ' ' }))
          .status,
      ).toBe(400);
    });

    it('answers 404 for a non-member, a deleted item and an entry of another item', async () => {
      const { w, item, url, add } = await withTask();
      const entry = await add('Mine');
      const other = (await w.add({ kind: 'TASK', title: 'Other' })).body;
      const otherUrl = `/api/items/${other.id}/checklist`;
      const outsider = (await api.signInReady()).cookie;

      const refused = await Promise.all([
        api.send('POST', url, outsider, { text: 'X' }),
        api.send('PATCH', `${url}/${entry.id}`, outsider, { done: true }),
        api.send('DELETE', `${url}/${entry.id}`, outsider),
        api.send('PUT', `${url}/order`, outsider, { ids: [entry.id] }),
        api.send('PATCH', `${otherUrl}/${entry.id}`, w.cookie, { done: true }),
        api.send('DELETE', `${otherUrl}/${entry.id}`, w.cookie),
      ]);
      expect(refused.map((r) => r.status)).toEqual(Array(6).fill(404));
      expect(
        (await api.send('GET', `/api/items/${item.id}`, w.cookie)).status,
      ).toBe(200);

      expect(
        (await api.send('DELETE', `/api/items/${item.id}`, w.cookie)).status,
      ).toBe(200);
      const gone = await Promise.all([
        api.send('POST', url, w.cookie, { text: 'X' }),
        api.send('PATCH', `${url}/${entry.id}`, w.cookie, { done: true }),
        api.send('DELETE', `${url}/${entry.id}`, w.cookie),
        api.send('PUT', `${url}/order`, w.cookie, { ids: [entry.id] }),
      ]);
      expect(gone.map((r) => r.status)).toEqual(Array(4).fill(404));
    });

    it('deletes an entry and closes the gap', async () => {
      const { w, url, add, list } = await withTask();
      const [a, b, c] = [await add('A'), await add('B'), await add('C')];
      const res = await api.send('DELETE', `${url}/${b.id}`, w.cookie);
      expect(res.status).toBe(200);
      expect((await list()).map((e) => [e.id, e.position])).toEqual([
        [a.id, 0],
        [c.id, 1],
      ]);
      expect(
        (await api.send('DELETE', `${url}/${b.id}`, w.cookie)).status,
      ).toBe(404);
    });

    it('reorders, and answers 400 invalid_order unless ids are exactly the entries', async () => {
      const { w, url, add, list } = await withTask();
      const [a, b, c] = [await add('A'), await add('B'), await add('C')];
      const put = (ids: string[]) =>
        api.send('PUT', `${url}/order`, w.cookie, { ids });

      const ok = await put([c.id, a.id, b.id]);
      expect(ok.status).toBe(200);
      expect(((await read(ok)) as Entry[]).map((e) => e.text)).toEqual([
        'C',
        'A',
        'B',
      ]);
      expect((await list()).map((e) => [e.text, e.position])).toEqual([
        ['C', 0],
        ['A', 1],
        ['B', 2],
      ]);

      const other = (await w.add({ kind: 'TASK', title: 'O' })).body;
      const foreign = (await read(
        await api.send('POST', `/api/items/${other.id}/checklist`, w.cookie, {
          text: 'F',
        }),
      )) as Entry;
      for (const ids of [
        [a.id, b.id],
        [a.id, a.id, b.id],
        [a.id, b.id, c.id, c.id],
        [a.id, b.id, foreign.id],
        [],
      ]) {
        const res = await put(ids);
        expect(res.status).toBe(400);
        expect(await read(res)).toMatchObject({ code: 'invalid_order' });
      }
      expect((await list()).map((e) => e.text)).toEqual(['C', 'A', 'B']);
    });

    it('keeps the entries with a deleted item and brings them back on restore', async () => {
      const { w, item, add, list } = await withTask();
      await add('Stays');
      await api.send('DELETE', `/api/items/${item.id}`, w.cookie);
      await api.send('POST', `/api/items/${item.id}/restore`, w.cookie);
      expect((await list()).map((e) => e.text)).toEqual(['Stays']);
    });
  });

  it('answers 404 to someone outside the project, on every route', async () => {
    const w = await project('STANDARD');
    const item = (await w.add({ kind: 'TASK', title: 'I' })).body;
    const outsider = await api.signInReady();

    const responses = await Promise.all([
      api.send('GET', `/api/projects/${w.id}/items`, outsider.cookie),
      api.send('POST', `/api/projects/${w.id}/items`, outsider.cookie, {
        kind: 'TASK',
        title: 'X',
      }),
      api.send('GET', `/api/items/${item.id}`, outsider.cookie),
      api.send('PATCH', `/api/items/${item.id}`, outsider.cookie, {
        title: 'X',
      }),
      api.send('POST', `/api/items/${item.id}/move`, outsider.cookie, {
        stateId: item.state.id,
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
      api.send('GET', `/api/projects/${w.id}/items/deleted`, outsider.cookie),
      api.send('POST', `/api/items/${item.id}/restore`, outsider.cookie),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(404));
    expect(
      (await api.send('GET', `/api/items/not-a-uuid`, outsider.cookie)).status,
    ).toBe(404);
  });

  it('lists slim rows for members', async () => {
    const w = await project('GUIDED');
    await w.add({ kind: 'FEATURE', title: 'Sign-in' });
    const rows = (await read(
      await api.send('GET', `/api/projects/${w.id}/items`, w.cookie),
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
        canMove: true,
        parentId: null,
      },
    ]);
  });
});
