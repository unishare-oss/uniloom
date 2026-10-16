import { prisma } from '@/db/prisma.js';
import { processNextReviewEvent } from '@/modules/notifications/notification.service.js';
import { MCP_RESOURCE, startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

describe('delete project (e2e)', () => {
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

  /** An owner, a project with one item and an approval link, plus a manager and a member. */
  const setup = async () => {
    const owner = await api.signInReady();
    const keyPrefix = freshPrefix();
    const { id } = (await read(
      await api.send('POST', '/api/projects', owner.cookie, {
        name: 'Doomed',
        keyPrefix,
        mode: 'STANDARD',
      }),
    )) as { id: string };
    const item = (await read(
      await api.send('POST', `/api/projects/${id}/items`, owner.cookie, {
        kind: 'TASK',
        title: 'A task',
      }),
    )) as { id: string; key: string };
    const link = (await read(
      await api.send('POST', `/api/projects/${id}/invite`, owner.cookie, {
        expiresIn: '7d',
        maxUses: null,
        joinApproval: true,
      }),
    )) as { token: string };
    const add = async (role: string) => {
      const person = await api.signInReady();
      await api.send('POST', `/api/projects/${id}/members`, owner.cookie, {
        email: person.profile.email,
        role,
      });
      return person;
    };
    const manager = await add('MANAGER');
    const member = await add('MEMBER');
    return { owner, manager, member, id, keyPrefix, item, link };
  };

  it('lets only an Owner delete, keeps the rows and sets canDeleteProject', async () => {
    const w = await setup();
    for (const person of [w.manager, w.member]) {
      expect(
        (await api.send('DELETE', `/api/projects/${w.id}`, person.cookie))
          .status,
      ).toBe(403);
    }
    const detail = (id: string, cookie: string) =>
      api.send('GET', `/api/projects/${id}`, cookie);
    expect(
      (
        (await read(await detail(w.id, w.owner.cookie))) as {
          canDeleteProject: boolean;
        }
      ).canDeleteProject,
    ).toBe(true);
    expect(
      (
        (await read(await detail(w.id, w.manager.cookie))) as {
          canDeleteProject: boolean;
        }
      ).canDeleteProject,
    ).toBe(false);

    const outsider = await api.signInReady();
    expect(
      (await api.send('DELETE', `/api/projects/${w.id}`, outsider.cookie))
        .status,
    ).toBe(404);

    expect(
      (await api.send('DELETE', `/api/projects/${w.id}`, w.owner.cookie))
        .status,
    ).toBe(200);
    const row = await prisma.project.findUniqueOrThrow({
      where: { id: w.id },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(await prisma.item.count({ where: { projectId: w.id } })).toBe(1);

    expect(
      (await api.send('DELETE', `/api/projects/${w.id}`, w.owner.cookie))
        .status,
    ).toBe(404);
  });

  it('answers 404 to every member on the project and what it holds, and hides it from lists', async () => {
    const w = await setup();
    await api.send('DELETE', `/api/projects/${w.id}`, w.owner.cookie);
    const paths = [
      `/api/projects/${w.id}`,
      `/api/projects/${w.id}/items`,
      `/api/projects/${w.id}/members`,
      `/api/projects/${w.id}/labels`,
      `/api/projects/${w.id}/documents`,
      `/api/projects/${w.id}/invite`,
    ];
    for (const person of [w.owner, w.manager, w.member])
      for (const path of paths)
        expect((await api.send('GET', path, person.cookie)).status).toBe(404);

    const list = (await read(
      await api.send('GET', '/api/projects', w.owner.cookie),
    )) as { id: string }[];
    expect(list.find((p) => p.id === w.id)).toBeUndefined();
  });

  it('turns an old invite link into not found and stops a waiting request being approved', async () => {
    const w = await setup();
    const joiner = await api.signInReady();
    await api.send('POST', `/api/invites/${w.link.token}/join`, joiner.cookie);
    const waiting = await prisma.joinRequest.findFirstOrThrow({
      where: { projectId: w.id },
    });
    await api.send('DELETE', `/api/projects/${w.id}`, w.owner.cookie);

    const preview = await api.send(
      'GET',
      `/api/invites/${w.link.token}`,
      joiner.cookie,
    );
    expect(preview.status).toBe(404);
    const join = await api.send(
      'POST',
      `/api/invites/${w.link.token}/join`,
      joiner.cookie,
    );
    expect(join.status).toBe(404);
    const approve = await api.send(
      'POST',
      `/api/projects/${w.id}/join-requests/${waiting.id}/approve`,
      w.owner.cookie,
    );
    expect(approve.status).toBe(404);
    expect(
      await prisma.member.count({
        where: { projectId: w.id, userId: waiting.userId },
      }),
    ).toBe(0);
    const mine = JSON.stringify(
      await read(await api.send('GET', '/api/join-requests', joiner.cookie)),
    );
    expect(mine).not.toContain(w.id);
  });

  it('has no MCP tool that deletes a project, and MCP lookups of a deleted project fail', async () => {
    const w = await setup();
    const token = await api.uniauth.signAgentToken(
      w.owner.profile.sub,
      MCP_RESOURCE,
    );
    const rpc = (method: string, params?: unknown) =>
      api.call('/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
    const callTool = async (name: string, args: Record<string, unknown>) => {
      const { result } = (await (
        await rpc('tools/call', { name, arguments: args })
      ).json()) as {
        result: { isError?: boolean; content: { text: string }[] };
      };
      return { isError: result.isError === true, text: result.content[0].text };
    };

    const listed = (await (await rpc('tools/list')).json()) as {
      result: { tools: { name: string }[] };
    };
    const names = listed.result.tools.map((t) => t.name);
    expect(names.filter((name) => /delete/.test(name))).toEqual([
      'delete_item',
    ]);
    expect(
      names.some(
        (name) => name.includes('project') && name !== 'list_projects',
      ),
    ).toBe(false);

    expect(
      (await callTool('list_items', { project: w.keyPrefix })).isError,
    ).toBe(false);
    expect((await callTool('get_item', { key: w.item.key })).isError).toBe(
      false,
    );
    await api.send('DELETE', `/api/projects/${w.id}`, w.owner.cookie);
    const byProject = await callTool('list_items', { project: w.keyPrefix });
    expect(byProject.isError).toBe(true);
    expect(byProject.text).toMatch(/not.?found/i);
    const byTicket = await callTool('get_item', { key: w.item.key });
    expect(byTicket.isError).toBe(true);
    expect(byTicket.text).toMatch(/not.?found/i);
  });

  it('lets a second Owner delete the project', async () => {
    const w = await setup();
    const second = await api.signInReady();
    await api.send('POST', `/api/projects/${w.id}/members`, w.owner.cookie, {
      email: second.profile.email,
      role: 'OWNER',
    });
    expect(
      (await api.send('DELETE', `/api/projects/${w.id}`, second.cookie)).status,
    ).toBe(200);
    expect(
      (await api.send('GET', `/api/projects/${w.id}`, w.owner.cookie)).status,
    ).toBe(404);
  });

  it('hides the project from the review queue and notifications, and the worker sends nothing new', async () => {
    const owner = await api.signInReady();
    const member = await api.signInReady();
    const { id } = (await read(
      await api.send('POST', '/api/projects', owner.cookie, {
        name: 'Reviewed',
        keyPrefix: freshPrefix(),
        mode: 'GUIDED',
      }),
    )) as { id: string };
    await api.send('PATCH', `/api/projects/${id}`, owner.cookie, {
      checklistRequired: false,
    });
    await api.send('POST', `/api/projects/${id}/members`, owner.cookie, {
      email: member.profile.email,
      role: 'MEMBER',
    });
    const memberRow = await prisma.user.findUniqueOrThrow({
      where: { email: member.profile.email },
    });
    const detail = (await read(
      await api.send('GET', `/api/projects/${id}`, owner.cookie),
    )) as { states: { id: string; key: string }[] };
    const stateId = (key: string) =>
      detail.states.find((state) => state.key === key)!.id;
    const feature = (await read(
      await api.send('POST', `/api/projects/${id}/items`, owner.cookie, {
        kind: 'FEATURE',
        title: 'Feature',
      }),
    )) as { id: string };
    const item = (await read(
      await api.send('POST', `/api/projects/${id}/items`, owner.cookie, {
        kind: 'SLICE',
        title: 'Review me',
        parentId: feature.id,
        assigneeId: memberRow.id,
        stateId: stateId('ready'),
      }),
    )) as { id: string };
    expect(
      (
        await api.send('POST', `/api/items/${item.id}/move`, member.cookie, {
          stateId: stateId('in_review'),
        })
      ).status,
    ).toBe(200);

    /** Runs the worker until this event is processed (other tests' events may come first). */
    const process = async (eventId: string) => {
      for (let i = 0; i < 100; i++) {
        const event = await prisma.reviewEvent.findUniqueOrThrow({
          where: { id: eventId },
        });
        if (event.processedAt) return;
        await prisma.reviewEvent.update({
          where: { id: eventId },
          data: { nextAttemptAt: new Date(0) },
        });
        await processNextReviewEvent();
      }
    };
    const first = await prisma.reviewEvent.findFirstOrThrow({
      where: { itemId: item.id },
    });
    await process(first.id);

    const reviews = async () =>
      JSON.stringify(
        await read(await api.send('GET', '/api/reviews', owner.cookie)),
      );
    const notifications = async () =>
      (await read(
        await api.send('GET', '/api/notifications', owner.cookie),
      )) as { groups: { item: { id: string } }[]; unreadCount: number };
    expect(await reviews()).toContain(id);
    const before = await notifications();
    expect(before.groups.some((g) => g.item.id === item.id)).toBe(true);
    expect(before.unreadCount).toBeGreaterThan(0);

    const { id: _id, processedAt: _processedAt, ...rest } = first;
    const second = await prisma.reviewEvent.create({
      data: { ...rest, processedAt: null, nextAttemptAt: new Date(0) },
    });
    await api.send('DELETE', `/api/projects/${id}`, owner.cookie);

    expect(await reviews()).not.toContain(id);
    const after = await notifications();
    expect(after.groups.some((g) => g.item.id === item.id)).toBe(false);
    expect(after.unreadCount).toBe(before.unreadCount - 1);

    await process(second.id);
    expect(
      await prisma.notification.count({ where: { eventId: second.id } }),
    ).toBe(0);
  });
});
