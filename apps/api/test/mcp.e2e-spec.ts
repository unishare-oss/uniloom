import { prisma } from '@/db/prisma.js';
import { MCP_RESOURCE, startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

describe('mcp (e2e)', () => {
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

  /** A JSON-RPC request to /mcp with a Bearer token (none when `token` is null). */
  const rpc = (token: string | null, method: string, params?: unknown) =>
    api.call('/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });

  /** Calls a tool; returns whether it failed and its text. */
  const tool = async (
    token: string,
    name: string,
    args: Record<string, unknown> = {},
  ) => {
    const res = await rpc(token, 'tools/call', { name, arguments: args });
    expect(res.status).toBe(200);
    const { result } = (await res.json()) as {
      result: { isError?: boolean; content: { text: string }[] };
    };
    return { isError: result.isError === true, text: result.content[0].text };
  };

  /** A signed-in owner with a Guided project TG-style and one slice with a checklist. */
  const setup = async () => {
    const owner = await api.signInReady();
    const keyPrefix = freshPrefix();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'M',
      keyPrefix,
      mode: 'GUIDED',
    });
    const { id } = (await read(created)) as { id: string };
    const feature = (await read(
      await api.send('POST', `/api/projects/${id}/items`, owner.cookie, {
        kind: 'FEATURE',
        title: 'Parent',
      }),
    )) as { id: string; key: string };
    const slice = (await read(
      await api.send('POST', `/api/projects/${id}/items`, owner.cookie, {
        kind: 'SLICE',
        title: 'Child',
        parentId: feature.id,
      }),
    )) as { id: string; key: string };
    await api.send('POST', `/api/items/${slice.id}/checklist`, owner.cookie, {
      text: 'It works',
    });
    const token = await api.uniauth.signAgentToken(
      owner.profile.sub,
      MCP_RESOURCE,
    );
    return { keyPrefix, feature, slice, token, owner };
  };

  describe('discovery and auth', () => {
    it('publishes the protected-resource metadata at both paths', async () => {
      for (const path of [
        '/.well-known/oauth-protected-resource',
        '/.well-known/oauth-protected-resource/mcp',
      ]) {
        const res = await api.call(path);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          resource: MCP_RESOURCE,
          authorization_servers: [api.uniauth.issuer],
          bearer_methods_supported: ['header'],
        });
      }
    });

    it('answers 401 with a resource_metadata challenge without a token', async () => {
      const res = await rpc(null, 'tools/list');
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe(
        `Bearer resource_metadata="http://127.0.0.1:3013/.well-known/oauth-protected-resource/mcp"`,
      );
      expect((await res.json()).code).toBe('unauthorized');
    });

    it('refuses a token for another audience', async () => {
      const w = await setup();
      const token = await api.uniauth.signAgentToken(
        w.owner.profile.sub,
        'http://127.0.0.1:3000/mcp',
      );
      expect((await rpc(token, 'tools/list')).status).toBe(401);
    });

    it('refuses an expired token', async () => {
      const w = await setup();
      const token = await api.uniauth.signAgentToken(
        w.owner.profile.sub,
        MCP_RESOURCE,
        {},
        '-1m',
      );
      expect((await rpc(token, 'tools/list')).status).toBe(401);
    });

    it('refuses a sub that never signed in to Uniloom', async () => {
      const token = await api.uniauth.signAgentToken('u_unknown', MCP_RESOURCE);
      expect((await rpc(token, 'tools/list')).status).toBe(401);
    });

    it('refuses a person who has not accepted the terms', async () => {
      const profile = api.newProfile();
      await api.signIn(profile);
      const token = await api.uniauth.signAgentToken(profile.sub, MCP_RESOURCE);
      const res = await rpc(token, 'tools/list');
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('consent_required');
    });
  });

  describe('server', () => {
    it('sends instructions and the read and write tools', async () => {
      const w = await setup();
      const init = await rpc(w.token, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      });
      const { result } = (await init.json()) as {
        result: { instructions: string };
      };
      expect(result.instructions).toContain('3 to 6');
      expect(result.instructions).toContain('TG-12');
      expect(result.instructions).toContain('people_only');

      const list = await rpc(w.token, 'tools/list');
      const names = (
        (await list.json()) as { result: { tools: { name: string }[] } }
      ).result.tools.map((t) => t.name);
      expect(names.sort()).toEqual([
        'check_criterion',
        'delete_item',
        'get_criteria',
        'get_item',
        'list_items',
        'list_labels',
        'list_projects',
        'list_states',
        'save_item',
        'set_criteria',
      ]);
    });
  });

  describe('read tools', () => {
    it("lists the person's projects", async () => {
      const w = await setup();
      const { isError, text } = await tool(w.token, 'list_projects');
      expect(isError).toBe(false);
      expect(JSON.parse(text).map((p: { key: string }) => p.key)).toContain(
        w.keyPrefix,
      );
    });

    it('lists slim items and filters by state and parent', async () => {
      const w = await setup();
      const all = JSON.parse(
        (await tool(w.token, 'list_items', { project: w.keyPrefix })).text,
      );
      expect(all.map((i: { key: string }) => i.key).sort()).toEqual(
        [w.feature.key, w.slice.key].sort(),
      );
      expect(all[0].description).toBeUndefined();

      const children = JSON.parse(
        (
          await tool(w.token, 'list_items', {
            project: w.keyPrefix,
            parent: w.feature.key,
          })
        ).text,
      );
      expect(children.map((i: { key: string }) => i.key)).toEqual([
        w.slice.key,
      ]);

      const none = JSON.parse(
        (
          await tool(w.token, 'list_items', {
            project: w.keyPrefix,
            state: 'Done',
          })
        ).text,
      );
      expect(none).toEqual([]);
    });

    it('gets an item by key, case-insensitively', async () => {
      const w = await setup();
      const { text } = await tool(w.token, 'get_item', {
        key: w.slice.key.toLowerCase(),
      });
      const item = JSON.parse(text);
      expect(item.key).toBe(w.slice.key);
      expect(item.checklist).toHaveLength(1);
    });

    it('lists states and labels', async () => {
      const w = await setup();
      const states = JSON.parse(
        (await tool(w.token, 'list_states', { project: w.keyPrefix })).text,
      );
      expect(states.map((s: { name: string }) => s.name)[0]).toBe('Triage');
      const labels = JSON.parse(
        (await tool(w.token, 'list_labels', { project: w.keyPrefix })).text,
      );
      expect(labels.map((l: { name: string }) => l.name)).toContain('bug');
    });

    it('numbers the checklist from 1', async () => {
      const w = await setup();
      const entries = JSON.parse(
        (await tool(w.token, 'get_criteria', { key: w.slice.key })).text,
      );
      expect(entries).toEqual([
        { number: 1, text: 'It works', done: false, evidence: null },
      ]);
    });

    it('answers a non-member the same not_found as the website', async () => {
      const w = await setup();
      const stranger = await api.signInReady();
      const token = await api.uniauth.signAgentToken(
        stranger.profile.sub,
        MCP_RESOURCE,
      );
      expect(await tool(token, 'list_items', { project: w.keyPrefix })).toEqual(
        {
          isError: true,
          text: 'not_found: Project not found',
        },
      );
      // An existing item in someone else's project answers like a key that doesn't exist.
      expect(await tool(token, 'get_item', { key: w.slice.key })).toEqual({
        isError: true,
        text: 'not_found: Item not found',
      });
      expect(await tool(token, 'get_criteria', { key: w.slice.key })).toEqual({
        isError: true,
        text: 'not_found: Item not found',
      });
      expect(await tool(token, 'get_item', { key: 'nonsense' })).toEqual({
        isError: true,
        text: 'not_found: Item not found',
      });
    });

    it('answers a parent key from a private project like one that does not exist', async () => {
      const mine = await setup();
      const hidden = await setup();
      const notFound = { isError: true, text: 'not_found: Item not found' };
      expect(
        await tool(mine.token, 'list_items', {
          project: mine.keyPrefix,
          parent: hidden.feature.key,
        }),
      ).toEqual(notFound);
      expect(
        await tool(mine.token, 'list_items', {
          project: mine.keyPrefix,
          parent: `${mine.keyPrefix}-999`,
        }),
      ).toEqual(notFound);
    });
  });
});
