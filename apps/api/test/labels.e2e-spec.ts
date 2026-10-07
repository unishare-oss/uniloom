import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Label {
  id: string;
  name: string;
  color: string;
  group: string | null;
  code?: string;
}

interface Item {
  id: string;
  labels: { id: string; name: string; color: string }[];
  code?: string;
  message?: string;
}

describe('labels (e2e)', () => {
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

  /** A project with an owner, a manager, a member and an outsider, and one task. */
  const setup = async () => {
    const owner = await api.signInReady();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'L',
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
    const outsider = (await api.signInReady()).cookie;
    const item = (await read(
      await api.send('POST', `/api/projects/${id}/items`, owner.cookie, {
        kind: 'TASK',
        title: 'T',
      }),
    )) as Item;
    const labels = async (cookie = owner.cookie) =>
      (await read(
        await api.send('GET', `/api/projects/${id}/labels`, cookie),
      )) as Label[];
    const add = async (cookie: string, body: Record<string, unknown>) => {
      const res = await api.send(
        'POST',
        `/api/projects/${id}/labels`,
        cookie,
        body,
      );
      return { status: res.status, body: (await read(res)) as Label };
    };
    const setLabels = async (cookie: string, ids: string[]) => {
      const res = await api.send('PATCH', `/api/items/${item.id}`, cookie, {
        labelIds: ids,
      });
      return { status: res.status, body: (await read(res)) as Item };
    };
    return {
      id,
      owner: owner.cookie,
      manager,
      member,
      outsider,
      item,
      labels,
      add,
      setLabels,
    };
  };

  it('gives a new project the four type labels', async () => {
    const w = await setup();
    const labels = await w.labels();
    expect(
      labels
        .map((l) => [l.name, l.color, l.group])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['bug', 'RED', 'type'],
      ['chore', 'GRAY', 'type'],
      ['enhancement', 'BLUE', 'type'],
      ['tech-debt', 'ORANGE', 'type'],
    ]);
  });

  it('lists for every member and 404s a non-member', async () => {
    const w = await setup();
    for (const cookie of [w.owner, w.manager, w.member])
      expect((await w.labels(cookie)).length).toBe(4);
    const res = await api.send(
      'GET',
      `/api/projects/${w.id}/labels`,
      w.outsider,
    );
    expect(res.status).toBe(404);
  });

  describe('creating and changing', () => {
    it('lets an owner and a manager create; a member gets 403, an outsider 404', async () => {
      const w = await setup();
      expect((await w.add(w.owner, { name: 'a', color: 'GREEN' })).status).toBe(
        201,
      );
      const made = await w.add(w.manager, { name: 'b', color: 'PINK' });
      expect(made.status).toBe(201);
      expect(made.body).toMatchObject({
        name: 'b',
        color: 'PINK',
        group: null,
      });
      expect((await w.add(w.member, { name: 'c', color: 'GRAY' })).status).toBe(
        403,
      );
      expect(
        (await w.add(w.outsider, { name: 'c', color: 'GRAY' })).status,
      ).toBe(404);
    });

    it('lets only the owner create a label with a group', async () => {
      const w = await setup();
      expect(
        (await w.add(w.manager, { name: 'a', color: 'GRAY', group: 'size' }))
          .status,
      ).toBe(403);
      expect(
        (await w.add(w.owner, { name: 'a', color: 'GRAY', group: 'size' })).body
          .group,
      ).toBe('size');
    });

    it('refuses a duplicate name with 409 label_name_taken, on create and rename', async () => {
      const w = await setup();
      const dup = await w.add(w.owner, { name: 'bug', color: 'GRAY' });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('label_name_taken');

      const free = await w.add(w.owner, { name: 'free', color: 'GRAY' });
      const res = await api.send(
        'PATCH',
        `/api/labels/${free.body.id}`,
        w.owner,
        {
          name: 'bug',
        },
      );
      expect(res.status).toBe(409);
      expect(((await read(res)) as Label).code).toBe('label_name_taken');
    });

    it('refuses a bad colour or empty name (400)', async () => {
      const w = await setup();
      expect((await w.add(w.owner, { name: 'x', color: 'TEAL' })).status).toBe(
        400,
      );
      expect((await w.add(w.owner, { name: ' ', color: 'RED' })).status).toBe(
        400,
      );
    });

    it('lets a manager rename and recolour, but not regroup or delete', async () => {
      const w = await setup();
      const bug = (await w.labels()).find((l) => l.name === 'bug')!;
      const ok = await api.send('PATCH', `/api/labels/${bug.id}`, w.manager, {
        name: 'defect',
        color: 'PURPLE',
      });
      expect(ok.status).toBe(200);
      expect(await read(ok)).toMatchObject({
        name: 'defect',
        color: 'PURPLE',
        group: 'type',
      });
      // Sending the group it already has is not a change of group.
      expect(
        (
          await api.send('PATCH', `/api/labels/${bug.id}`, w.manager, {
            group: 'type',
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await api.send('PATCH', `/api/labels/${bug.id}`, w.manager, {
            group: null,
          })
        ).status,
      ).toBe(403);
      expect(
        (await api.send('DELETE', `/api/labels/${bug.id}`, w.manager)).status,
      ).toBe(403);
    });

    it('lets the owner regroup, and a member change nothing', async () => {
      const w = await setup();
      const bug = (await w.labels()).find((l) => l.name === 'bug')!;
      const moved = await api.send('PATCH', `/api/labels/${bug.id}`, w.owner, {
        group: null,
      });
      expect(((await read(moved)) as Label).group).toBeNull();
      expect(
        (
          await api.send('PATCH', `/api/labels/${bug.id}`, w.member, {
            name: 'x',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await api.send('PATCH', `/api/labels/${bug.id}`, w.outsider, {
            name: 'x',
          })
        ).status,
      ).toBe(404);
    });

    it('404s an unknown label', async () => {
      const w = await setup();
      const id = '00000000-0000-7000-8000-000000000000';
      expect(
        (await api.send('PATCH', `/api/labels/${id}`, w.owner, {})).status,
      ).toBe(404);
      expect(
        (await api.send('DELETE', `/api/labels/${id}`, w.owner)).status,
      ).toBe(404);
    });
  });

  describe('on items', () => {
    it('sets and replaces an item’s labels, shown on the item and in lists', async () => {
      const w = await setup();
      const all = await w.labels();
      const bug = all.find((l) => l.name === 'bug')!;
      const free = (await w.add(w.owner, { name: 'free', color: 'GREEN' }))
        .body;

      const set = await w.setLabels(w.member, [bug.id, free.id]);
      expect(set.status).toBe(200);
      expect(set.body.labels.map((l) => l.name)).toEqual(['bug', 'free']);

      const got = (await read(
        await api.send('GET', `/api/items/${w.item.id}`, w.owner),
      )) as Item;
      expect(got.labels).toEqual([
        { id: bug.id, name: 'bug', color: 'RED' },
        { id: free.id, name: 'free', color: 'GREEN' },
      ]);
      const rows = (await read(
        await api.send('GET', `/api/projects/${w.id}/items`, w.owner),
      )) as Item[];
      expect(rows[0].labels.map((l) => l.name)).toEqual(['bug', 'free']);

      const replaced = await w.setLabels(w.member, [free.id, free.id]);
      expect(replaced.body.labels.map((l) => l.name)).toEqual(['free']);
      expect((await w.setLabels(w.member, [])).body.labels).toEqual([]);
    });

    it('leaves the labels alone when labelIds is not sent', async () => {
      const w = await setup();
      const bug = (await w.labels()).find((l) => l.name === 'bug')!;
      await w.setLabels(w.owner, [bug.id]);
      const res = await api.send('PATCH', `/api/items/${w.item.id}`, w.owner, {
        title: 'Renamed',
      });
      expect(((await read(res)) as Item).labels.length).toBe(1);
    });

    it('refuses two labels of one group with 409 naming the group', async () => {
      const w = await setup();
      const all = await w.labels();
      const bug = all.find((l) => l.name === 'bug')!;
      const chore = all.find((l) => l.name === 'chore')!;
      const res = await w.setLabels(w.owner, [bug.id, chore.id]);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('label_group_conflict');
      expect(res.body.message).toContain('"type"');
      // Nothing was saved.
      const got = (await read(
        await api.send('GET', `/api/items/${w.item.id}`, w.owner),
      )) as Item;
      expect(got.labels).toEqual([]);
    });

    it('refuses a label from another project or an unknown one (400)', async () => {
      const w = await setup();
      const other = await setup();
      const foreign = (await other.labels())[0];
      const foreignRes = await w.setLabels(w.owner, [foreign.id]);
      expect(foreignRes.status).toBe(400);
      expect(foreignRes.body.code).toBe('invalid_labels');
      expect(
        (await w.setLabels(w.owner, ['00000000-0000-7000-8000-000000000000']))
          .status,
      ).toBe(400);
    });

    it('does not touch items that already hold two labels of a group that was just formed', async () => {
      const w = await setup();
      const a = (await w.add(w.owner, { name: 'a', color: 'GRAY' })).body;
      const b = (await w.add(w.owner, { name: 'b', color: 'GRAY' })).body;
      await w.setLabels(w.owner, [a.id, b.id]);
      const res = await api.send('PATCH', `/api/labels/${a.id}`, w.owner, {
        group: 'size',
      });
      expect(res.status).toBe(200);
      await api.send('PATCH', `/api/labels/${b.id}`, w.owner, {
        group: 'size',
      });
      const got = (await read(
        await api.send('GET', `/api/items/${w.item.id}`, w.owner),
      )) as Item;
      expect(got.labels.length).toBe(2);
      // The next label edit has to resolve it.
      expect((await w.setLabels(w.owner, [a.id, b.id])).status).toBe(409);
      expect((await w.setLabels(w.owner, [a.id])).status).toBe(200);
    });
  });

  it('deleting a label removes it from every item', async () => {
    const w = await setup();
    const bug = (await w.labels()).find((l) => l.name === 'bug')!;
    await w.setLabels(w.owner, [bug.id]);

    const res = await api.send('DELETE', `/api/labels/${bug.id}`, w.owner);
    expect(res.status).toBe(200);

    const got = (await read(
      await api.send('GET', `/api/items/${w.item.id}`, w.owner),
    )) as Item;
    expect(got.labels).toEqual([]);
    expect((await w.labels()).map((l) => l.name)).not.toContain('bug');
  });

  it('GET /projects/:id tells who can create labels', async () => {
    const w = await setup();
    const flag = async (cookie: string) =>
      (
        (await read(
          await api.send('GET', `/api/projects/${w.id}`, cookie),
        )) as { canCreateLabels: boolean }
      ).canCreateLabels;
    expect(await flag(w.owner)).toBe(true);
    expect(await flag(w.manager)).toBe(true);
    expect(await flag(w.member)).toBe(false);
  });
});
