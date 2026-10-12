import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface Row {
  action: string;
  detail: Record<string, any>;
  by: { name: string | null; image: string | null };
  agent: { name: string | null } | null;
}

describe('item activity (e2e)', () => {
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

  /** A signed-in owner with a new Guided project and one feature in it. */
  const setup = async () => {
    const owner = await api.signInReady();
    const me = (await read(await api.send('GET', '/api/me', owner.cookie))) as {
      id: string;
    };
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'W',
      keyPrefix: freshPrefix(),
      mode: 'GUIDED',
    });
    const { id: projectId } = (await read(created)) as { id: string };
    const states = await prisma.state.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    const send = async (method: string, path: string, body?: unknown) =>
      read(await api.send(method, path, owner.cookie, body));
    const feature = (await send('POST', `/api/projects/${projectId}/items`, {
      kind: 'FEATURE',
      title: 'F',
    })) as { id: string; key: string };
    const activity = async (itemId = feature.id) =>
      (await send('GET', `/api/items/${itemId}/activity`)) as Row[];
    return { owner, me, projectId, states, send, feature, activity };
  };

  it('records an item being created, edited, moved, deleted and restored', async () => {
    const w = await setup();
    const slice = (await w.send('POST', `/api/projects/${w.projectId}/items`, {
      kind: 'SLICE',
      title: 'S',
      parentId: w.feature.id,
    })) as { id: string };
    await w.send('PATCH', `/api/items/${slice.id}`, {
      title: 'S2',
      description: 'long text',
      priority: 'HIGH',
      assigneeId: w.me.id,
    });
    // Nothing changes, so nothing is recorded.
    await w.send('PATCH', `/api/items/${slice.id}`, { title: 'S2' });
    const ready = w.states.find((state) => state.key === 'ready')!;
    await w.send('POST', `/api/items/${slice.id}/move`, { stateId: ready.id });
    await w.send('DELETE', `/api/items/${slice.id}`);
    await w.send('POST', `/api/items/${slice.id}/restore`);

    const rows = (await w.activity(slice.id)).reverse();
    expect(rows.map((row) => row.action)).toEqual([
      'item.create',
      'item.update',
      'item.move',
      'item.delete',
      'item.restore',
    ]);
    expect(rows[0].detail).toEqual({ parent: w.feature.key });
    expect(rows[1].detail.changes).toEqual([
      { field: 'title', from: 'S', to: 'S2' },
      { field: 'description' },
      { field: 'priority', from: 'NONE', to: 'HIGH' },
      { field: 'assignee', from: null, to: 'Mya' },
    ]);
    expect(rows[2].detail).toEqual({ from: 'Triage', to: ready.name });
    expect(rows[0].by.name).toBe('Mya');
    expect(rows[0].agent).toBeNull();
  });

  it('records the checklist: add, edit, tick with evidence, untick, remove', async () => {
    const w = await setup();
    const path = `/api/items/${w.feature.id}/checklist`;
    const entry = (await w.send('POST', path, { text: 'It works' })) as {
      id: string;
    };
    await w.send('PATCH', `${path}/${entry.id}`, { text: 'It works well' });
    await w.send('PATCH', `${path}/${entry.id}`, {
      done: true,
      evidence: 'abc123',
    });
    await w.send('PATCH', `${path}/${entry.id}`, { done: false });
    await w.send('DELETE', `${path}/${entry.id}`);

    const rows = (await w.activity()).reverse().slice(1);
    expect(rows.map((row) => [row.action, row.detail])).toEqual([
      ['checklist.add', { text: 'It works' }],
      ['checklist.edit', { from: 'It works', to: 'It works well' }],
      ['checklist.tick', { text: 'It works well', evidence: 'abc123' }],
      ['checklist.untick', { text: 'It works well' }],
      ['checklist.remove', { text: 'It works well' }],
    ]);
  });

  it('stores the agent of a change: client id and name', async () => {
    const w = await setup();
    const { moveItem } = await import('@/modules/items/item.service.js');
    const { addChecklistEntry } =
      await import('@/modules/items/checklist.service.js');
    const ready = w.states.find((state) => state.key === 'ready')!;
    await moveItem(w.feature.id, w.me.id, ready.id, {
      clientId: 'claude-code',
      clientName: 'Claude Code',
    });
    await addChecklistEntry(
      w.feature.id,
      w.me.id,
      { text: 'Nameless' },
      { clientId: 'other', clientName: null },
    );

    const stored = await prisma.activity.findMany({
      where: { itemId: w.feature.id, action: 'item.move' },
    });
    expect(stored).toMatchObject([
      { clientId: 'claude-code', agentName: 'Claude Code', userId: w.me.id },
    ]);
    const rows = await w.activity();
    expect(rows[0]).toMatchObject({
      action: 'checklist.add',
      agent: { name: null },
    });
    expect(rows[1]).toMatchObject({
      action: 'item.move',
      agent: { name: 'Claude Code' },
    });
  });

  it('answers 404 to a non-member, like the item', async () => {
    const w = await setup();
    const outsider = await api.signInReady();
    const res = await api.send(
      'GET',
      `/api/items/${w.feature.id}/activity`,
      outsider.cookie,
    );
    expect(res.status).toBe(404);
  });

  it('removes the rows with their project', async () => {
    const w = await setup();
    await prisma.project.delete({ where: { id: w.projectId } });
    expect(
      await prisma.activity.count({ where: { projectId: w.projectId } }),
    ).toBe(0);
  });
});
