import { prisma } from '@/db/prisma.js';
import { MCP_RESOURCE, startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

describe('mcp write tools (e2e)', () => {
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

  /** Calls a tool through /mcp; returns whether it failed and its text. */
  const tool = async (
    token: string,
    name: string,
    args: Record<string, unknown> = {},
  ) => {
    const res = await api.call('/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    expect(res.status).toBe(200);
    const { result } = (await res.json()) as {
      result: { isError?: boolean; content: { text: string }[] };
    };
    return { isError: result.isError === true, text: result.content[0].text };
  };

  /** A tool call that must succeed; returns its parsed answer. */
  const ok = async (
    token: string,
    name: string,
    args: Record<string, unknown> = {},
  ) => {
    const result = await tool(token, name, args);
    expect(result).toMatchObject({ isError: false });
    return JSON.parse(result.text);
  };

  const agentToken = (sub: string) =>
    api.uniauth.signAgentToken(sub, MCP_RESOURCE, {
      client_name: 'Claude Code',
    });

  /** A Guided project with an owner and a Member, each with an agent token. */
  const setup = async () => {
    const owner = await api.signInReady();
    const member = await api.signInReady();
    const keyPrefix = freshPrefix();
    const { id } = (await read(
      await api.send('POST', '/api/projects', owner.cookie, {
        name: 'W',
        keyPrefix,
        mode: 'GUIDED',
      }),
    )) as { id: string };
    expect(
      (
        await api.send('POST', `/api/projects/${id}/members`, owner.cookie, {
          email: member.profile.email,
          role: 'MEMBER',
        })
      ).status,
    ).toBe(201);
    return {
      id,
      keyPrefix,
      owner,
      member,
      ownerToken: await agentToken(owner.profile.sub),
      memberToken: await agentToken(member.profile.sub),
    };
  };

  /** A feature and a slice under it, made through the tool. */
  const withSlice = async () => {
    const w = await setup();
    const feature = await ok(w.ownerToken, 'save_item', {
      project: w.keyPrefix,
      kind: 'FEATURE',
      title: 'Feature',
    });
    const slice = await ok(w.ownerToken, 'save_item', {
      project: w.keyPrefix,
      kind: 'SLICE',
      title: 'Slice',
      parent: feature.key,
    });
    return { ...w, feature, slice };
  };

  describe('save_item and delete_item', () => {
    it('creates, updates and deletes an item', async () => {
      const w = await setup();
      const feature = await ok(w.ownerToken, 'save_item', {
        project: w.keyPrefix,
        kind: 'FEATURE',
        title: 'Feature',
        description: 'Why',
        priority: 'HIGH',
        assignee: 'none',
      });
      expect(feature).toMatchObject({
        title: 'Feature',
        priority: 'HIGH',
        assignee: null,
        state: 'Triage',
      });

      const updated = await ok(w.ownerToken, 'save_item', {
        key: feature.key,
        title: 'Renamed',
      });
      expect(updated).toMatchObject({
        key: feature.key,
        title: 'Renamed',
      });
      expect(updated.description).toBeUndefined();
      expect(
        await ok(w.ownerToken, 'get_item', { key: feature.key }),
      ).toMatchObject({ description: 'Why' });

      expect(
        await ok(w.ownerToken, 'delete_item', { key: feature.key }),
      ).toEqual({ deleted: feature.key });
      expect(
        await tool(w.ownerToken, 'get_item', { key: feature.key }),
      ).toEqual({ isError: true, text: 'not_found: Item not found' });
    });

    it('needs project, kind and title to create, and applies the website limits', async () => {
      const w = await setup();
      expect(
        await tool(w.ownerToken, 'save_item', { project: w.keyPrefix }),
      ).toEqual({
        isError: true,
        text: 'invalid_input: Creating an item needs project, kind and title',
      });
      const long = await tool(w.ownerToken, 'save_item', {
        project: w.keyPrefix,
        kind: 'FEATURE',
        title: 'x'.repeat(201),
      });
      expect(long.isError).toBe(true);
    });

    it('returns the service rule errors with their code', async () => {
      const w = await setup();
      const slice = await tool(w.ownerToken, 'save_item', {
        project: w.keyPrefix,
        kind: 'SLICE',
        title: 'No feature',
      });
      expect(slice.isError).toBe(true);
      expect(slice.text).toMatch(/^invalid_kind:/);
    });

    it("refuses a Member's agent to create or delete, with the service's 403", async () => {
      const w = await withSlice();
      expect(
        await tool(w.memberToken, 'save_item', {
          project: w.keyPrefix,
          kind: 'FEATURE',
          title: 'Mine',
        }),
      ).toEqual({
        isError: true,
        text: 'forbidden: Your role cannot do this',
      });
      expect(
        await tool(w.memberToken, 'delete_item', { key: w.slice.key }),
      ).toEqual({ isError: true, text: 'forbidden: Your role cannot do this' });
    });

    it("answers a non-member's agent not_found", async () => {
      const w = await withSlice();
      const stranger = await api.signInReady();
      const token = await agentToken(stranger.profile.sub);
      expect(
        await tool(token, 'save_item', { key: w.slice.key, title: 'Mine' }),
      ).toEqual({ isError: true, text: 'not_found: Item not found' });
      expect(
        await tool(token, 'save_item', {
          project: w.keyPrefix,
          kind: 'FEATURE',
          title: 'Mine',
        }),
      ).toEqual({ isError: true, text: 'not_found: Project not found' });
    });
  });

  describe('assignee', () => {
    it('takes me, none and a member email, and filters list_items the same way', async () => {
      const w = await withSlice();
      const mine = await ok(w.ownerToken, 'save_item', {
        key: w.slice.key,
        assignee: 'me',
      });
      expect(mine.assignee).toEqual({
        name: w.owner.profile.name,
        email: w.owner.profile.email,
      });

      const theirs = await ok(w.ownerToken, 'save_item', {
        key: w.slice.key,
        assignee: w.member.profile.email.toUpperCase(),
      });
      expect(theirs.assignee).toEqual({
        name: w.member.profile.name,
        email: w.member.profile.email,
      });

      const byEmail = await ok(w.ownerToken, 'list_items', {
        project: w.keyPrefix,
        assignee: w.member.profile.email,
      });
      expect(byEmail.map((i: { key: string }) => i.key)).toEqual([w.slice.key]);
      const byMe = await ok(w.memberToken, 'list_items', {
        project: w.keyPrefix,
        assignee: 'me',
      });
      expect(byMe.map((i: { key: string }) => i.key)).toEqual([w.slice.key]);
      const none = await ok(w.ownerToken, 'list_items', {
        project: w.keyPrefix,
        assignee: 'none',
      });
      expect(none.map((i: { key: string }) => i.key)).toEqual([w.feature.key]);

      await ok(w.ownerToken, 'save_item', {
        key: w.slice.key,
        assignee: 'none',
      });
    });

    it('answers invalid_assignee for an email that is no member', async () => {
      const w = await withSlice();
      const stranger = await api.signInReady();
      for (const assignee of ['nobody@example.com', stranger.profile.email]) {
        const result = await tool(w.ownerToken, 'save_item', {
          key: w.slice.key,
          assignee,
        });
        expect(result.isError).toBe(true);
        expect(result.text).toMatch(/^invalid_assignee:/);
      }
      const filter = await tool(w.ownerToken, 'list_items', {
        project: w.keyPrefix,
        assignee: 'nobody@example.com',
      });
      expect(filter.text).toMatch(/^invalid_assignee:/);
    });
  });

  describe('state', () => {
    it('moves an item by state name, case-insensitively', async () => {
      const w = await withSlice();
      const moved = await ok(w.ownerToken, 'save_item', {
        key: w.slice.key,
        state: 'in progress',
      });
      expect(moved.state).toBe('In Progress');
      const bad = await tool(w.ownerToken, 'save_item', {
        key: w.slice.key,
        state: 'Nowhere',
      });
      expect(bad.text).toMatch(/^invalid_state:/);
    });

    it('refuses Ready and Done with people_only, even for an owner, and saves nothing', async () => {
      const w = await withSlice();
      for (const state of ['Ready', 'Done']) {
        const result = await tool(w.ownerToken, 'save_item', {
          key: w.slice.key,
          title: 'Not saved',
          state,
        });
        expect(result.isError).toBe(true);
        expect(result.text).toMatch(/^people_only:/);
      }
      const item = await ok(w.ownerToken, 'get_item', { key: w.slice.key });
      expect(item).toMatchObject({ title: 'Slice', state: { name: 'Triage' } });
      const created = await tool(w.ownerToken, 'save_item', {
        project: w.keyPrefix,
        kind: 'FEATURE',
        title: 'Born done',
        state: 'Done',
      });
      expect(created.text).toMatch(/^people_only:/);
      const all = await ok(w.ownerToken, 'list_items', {
        project: w.keyPrefix,
      });
      expect(all).toHaveLength(2);
    });

    it('applies the checklist gate and the Member rules to a move', async () => {
      const w = await withSlice();
      await ok(w.ownerToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['One', 'Two', 'Three'],
      });
      await ok(w.ownerToken, 'save_item', {
        key: w.slice.key,
        state: 'In Progress',
        assignee: w.member.profile.email,
      });
      const early = await tool(w.memberToken, 'save_item', {
        key: w.slice.key,
        state: 'In Review',
      });
      expect(early.text).toMatch(/^criteria_incomplete:/);
      for (const number of [1, 2, 3])
        await ok(w.memberToken, 'check_criterion', {
          key: w.slice.key,
          which: number,
        });
      const moved = await ok(w.memberToken, 'save_item', {
        key: w.slice.key,
        state: 'In Review',
      });
      expect(moved.state).toBe('In Review');
      const locked = await tool(w.memberToken, 'save_item', {
        key: w.slice.key,
        state: 'In Progress',
      });
      expect(locked.text).toMatch(/^review_locked:/);
    });

    it('says what was saved when the move after a create or an edit fails', async () => {
      const w = await withSlice();
      // No checklist yet, so In Review is refused after the item is created.
      const created = await tool(w.ownerToken, 'save_item', {
        project: w.keyPrefix,
        kind: 'SLICE',
        title: 'Created, then refused',
        parent: w.feature.key,
        state: 'In Review',
      });
      expect(created.isError).toBe(true);
      expect(created.text).toMatch(
        new RegExp(
          `^criteria_incomplete: ${w.keyPrefix}-\\d+ was created, but it was not moved to In Review: `,
        ),
      );

      const edited = await tool(w.ownerToken, 'save_item', {
        key: w.slice.key,
        title: 'Renamed, then refused',
        state: 'In Review',
      });
      expect(edited.text).toMatch(
        new RegExp(
          `^criteria_incomplete: ${w.slice.key}'s changes are saved, but it was not moved to In Review: `,
        ),
      );
      const after = await ok(w.ownerToken, 'get_item', { key: w.slice.key });
      expect(after.title).toBe('Renamed, then refused');
    });
  });

  describe('criteria', () => {
    it('replaces the checklist in order and enforces the maximum', async () => {
      const w = await withSlice();
      const first = await ok(w.ownerToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['A', 'B', 'C'],
      });
      expect(first).toEqual([
        { number: 1, text: 'A', done: false, evidence: null },
        { number: 2, text: 'B', done: false, evidence: null },
        { number: 3, text: 'C', done: false, evidence: null },
      ]);
      const second = await ok(w.ownerToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['D', 'E', 'F', 'G'],
      });
      expect(second.map((e: { text: string }) => e.text)).toEqual([
        'D',
        'E',
        'F',
        'G',
      ]);

      const over = await tool(w.ownerToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['1', '2', '3', '4', '5', '6', '7'],
      });
      expect(over.isError).toBe(true);
      expect(over.text).toMatch(/^checklist_max_exceeded:/);
      const kept = await ok(w.ownerToken, 'get_criteria', { key: w.slice.key });
      expect(kept.map((e: { text: string }) => e.text)).toEqual([
        'D',
        'E',
        'F',
        'G',
      ]);
    });

    it('ticks one entry by number or by exact text, with evidence', async () => {
      const w = await withSlice();
      await ok(w.ownerToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['A', 'B', 'C'],
      });
      const byNumber = await ok(w.ownerToken, 'check_criterion', {
        key: w.slice.key,
        which: 2,
        evidence: 'commit 1a2b3c4',
      });
      expect(byNumber[1]).toEqual({
        number: 2,
        text: 'B',
        done: true,
        evidence: 'commit 1a2b3c4',
      });
      const byText = await ok(w.ownerToken, 'check_criterion', {
        key: w.slice.key,
        which: 'C',
      });
      expect(byText.map((e: { done: boolean }) => e.done)).toEqual([
        false,
        true,
        true,
      ]);
      const asString = await ok(w.ownerToken, 'check_criterion', {
        key: w.slice.key,
        which: '1',
      });
      expect(asString[0].done).toBe(true);
      for (const which of [9, 4, 'c']) {
        expect(
          await tool(w.ownerToken, 'check_criterion', {
            key: w.slice.key,
            which,
          }),
        ).toEqual({
          isError: true,
          text: 'not_found: Checklist entry not found',
        });
      }
    });
  });

  describe('members edit only their own tickets', () => {
    it("answers forbidden to a Member's agent on a ticket that is not theirs", async () => {
      const w = await withSlice();
      await ok(w.ownerToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['A', 'B', 'C'],
      });
      const forbidden =
        /^forbidden: Members can only edit tickets assigned to them/;

      const edit = await tool(w.memberToken, 'save_item', {
        key: w.slice.key,
        title: 'Rewritten',
      });
      expect(edit.isError).toBe(true);
      expect(edit.text).toMatch(forbidden);
      const set = await tool(w.memberToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['X', 'Y', 'Z'],
      });
      expect(set.isError).toBe(true);
      expect(set.text).toMatch(forbidden);
      const tick = await tool(w.memberToken, 'check_criterion', {
        key: w.slice.key,
        which: 1,
      });
      expect(tick.isError).toBe(true);
      expect(tick.text).toMatch(forbidden);

      // Claiming and editing in one call works, and then the checklist is theirs.
      const claimed = await ok(w.memberToken, 'save_item', {
        key: w.slice.key,
        assignee: 'me',
        title: 'Mine',
      });
      expect(claimed).toMatchObject({ title: 'Mine' });
      expect(
        await ok(w.memberToken, 'get_item', { key: w.slice.key }),
      ).toMatchObject({ canEdit: true });
      const ticked = await ok(w.memberToken, 'check_criterion', {
        key: w.slice.key,
        which: 1,
      });
      expect(ticked[0].done).toBe(true);
    });
  });

  describe('activity', () => {
    it('names the agent on every write', async () => {
      const w = await withSlice();
      await ok(w.ownerToken, 'save_item', {
        key: w.slice.key,
        priority: 'HIGH',
      });
      await ok(w.ownerToken, 'set_criteria', {
        key: w.slice.key,
        texts: ['A', 'B', 'C'],
      });
      await ok(w.ownerToken, 'check_criterion', { key: w.slice.key, which: 1 });
      await ok(w.ownerToken, 'save_item', {
        key: w.slice.key,
        state: 'In Progress',
      });
      await ok(w.ownerToken, 'delete_item', { key: w.slice.key });

      const rows = await prisma.activity.findMany({
        where: { projectId: w.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(rows.map((r) => r.action)).toEqual([
        'item.create',
        'item.create',
        'item.update',
        'checklist.replace',
        'checklist.tick',
        'item.move',
        'item.delete',
      ]);
      for (const row of rows) {
        expect(row.clientId).toBe('claude-code-test');
        expect(row.agentName).toBe('Claude Code');
      }
      const replace = rows.find((r) => r.action === 'checklist.replace');
      expect(replace?.detail).toEqual({ count: 3 });
    });
  });

  describe('list_projects', () => {
    it('returns key, name, mode, role and the checklist limits', async () => {
      const w = await setup();
      const asOwner = await ok(w.ownerToken, 'list_projects');
      expect(asOwner).toEqual([
        {
          key: w.keyPrefix,
          name: 'W',
          mode: 'GUIDED',
          role: 'OWNER',
          checklistMin: 3,
          checklistMax: 6,
          url: `http://127.0.0.1:3013/p/${w.id}`,
        },
      ]);
      const asMember = await ok(w.memberToken, 'list_projects');
      expect(asMember[0].role).toBe('MEMBER');
    });
  });
});
