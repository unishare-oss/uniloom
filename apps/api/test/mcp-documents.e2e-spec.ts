import { prisma } from '@/db/prisma.js';
import { MCP_RESOURCE, startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

describe('mcp document tools (e2e)', () => {
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

  /** A Guided project, a feature assigned to the Member and one assigned to nobody. */
  const withTickets = async () => {
    const w = await setup();
    const mine = await ok(w.ownerToken, 'save_item', {
      project: w.keyPrefix,
      kind: 'FEATURE',
      title: 'Mine',
      assignee: w.member.profile.email,
    });
    const theirs = await ok(w.ownerToken, 'save_item', {
      project: w.keyPrefix,
      kind: 'FEATURE',
      title: 'Theirs',
      assignee: 'none',
    });
    return { ...w, mine, theirs };
  };

  const FORBIDDEN = 'forbidden: Your role cannot do this';

  it('a manager creates, lists, reads and updates a Knowledge document', async () => {
    const w = await setup();
    const created = await ok(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'BRIEF',
      title: 'Brief',
      purpose: 'Why',
      body: '## Problem',
    });
    expect(created).toMatchObject({
      kind: 'BRIEF',
      title: 'Brief',
      url: `http://127.0.0.1:3013/p/${w.id}/docs/${created.id}`,
    });

    const rows = await ok(w.memberToken, 'list_documents', {
      project: w.keyPrefix,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: created.id, title: 'Brief' });
    expect(rows[0].body).toBeUndefined();
    expect(
      await ok(w.memberToken, 'list_documents', {
        project: w.keyPrefix,
        kind: 'SPEC',
      }),
    ).toEqual([]);

    const read = await ok(w.memberToken, 'get_document', { id: created.id });
    expect(read).toMatchObject({ body: '## Problem', homeItem: null });

    const updated = await ok(w.ownerToken, 'save_document', {
      id: created.id,
      title: 'Renamed',
      body: 'New',
    });
    expect(updated).toMatchObject({
      title: 'Renamed',
    });
    expect(updated.body).toBeUndefined();
    expect(
      await ok(w.ownerToken, 'get_document', { id: created.id }),
    ).toMatchObject({ body: 'New', purpose: 'Why' });
  });

  it('refuses a Member to create or edit a Knowledge document', async () => {
    const w = await setup();
    const created = await ok(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'BRIEF',
      title: 'Brief',
    });
    expect(
      await tool(w.memberToken, 'save_document', {
        project: w.keyPrefix,
        kind: 'BRIEF',
        title: 'Mine',
      }),
    ).toEqual({ isError: true, text: FORBIDDEN });
    expect(
      await tool(w.memberToken, 'save_document', {
        id: created.id,
        title: 'Mine',
      }),
    ).toEqual({ isError: true, text: FORBIDDEN });
  });

  it('answers not_found to a non-member and for a missing or malformed id', async () => {
    const w = await setup();
    const outsider = await api.signInReady();
    const outsiderToken = await agentToken(outsider.profile.sub);
    const created = await ok(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'BRIEF',
      title: 'Brief',
    });
    const notFound = (text: string) => ({ isError: true, text });
    expect(
      await tool(outsiderToken, 'list_documents', { project: w.keyPrefix }),
    ).toMatchObject(notFound('not_found: Project not found'));
    expect(
      (await tool(outsiderToken, 'get_document', { id: created.id })).text,
    ).toMatch(/^not_found:/);
    expect(
      await tool(w.ownerToken, 'get_document', {
        id: '00000000-0000-4000-8000-000000000000',
      }),
    ).toEqual(notFound('not_found: Document not found'));
    expect(await tool(w.ownerToken, 'get_document', { id: 'nope' })).toEqual(
      notFound('not_found: Document not found'),
    );
    expect(
      await tool(w.ownerToken, 'save_document', { id: 'nope', title: 'x' }),
    ).toEqual(notFound('not_found: Document not found'));
  });

  it("lets a Member write a spec on their own ticket, and refuses on someone else's", async () => {
    const w = await withTickets();
    const spec = await ok(w.memberToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'SPEC',
      title: 'Spec',
      ticket: w.mine.key,
    });
    expect(
      await ok(w.memberToken, 'get_document', { id: spec.id }),
    ).toMatchObject({
      kind: 'SPEC',
      homeItem: { key: w.mine.key },
      createdFrom: { key: w.mine.key },
      author: { name: w.member.profile.name },
    });
    // It is the ticket's own, so Knowledge does not list it; the member edits it.
    expect(
      await ok(w.memberToken, 'list_documents', { project: w.keyPrefix }),
    ).toEqual([]);
    expect(
      await ok(w.memberToken, 'save_document', { id: spec.id, body: 'Edited' }),
    ).toMatchObject({ id: spec.id });
    expect(
      await ok(w.memberToken, 'get_document', { id: spec.id }),
    ).toMatchObject({ body: 'Edited' });
    const item = await ok(w.memberToken, 'get_item', { key: w.mine.key });
    expect(item.related).toMatchObject([{ id: spec.id, home: 'ticket' }]);

    expect(
      await tool(w.memberToken, 'save_document', {
        project: w.keyPrefix,
        kind: 'SPEC',
        title: 'Spec',
        ticket: w.theirs.key,
      }),
    ).toMatchObject({
      isError: true,
      text: expect.stringMatching(/^forbidden:/),
    });
  });

  it('raises an ADR from a ticket into Knowledge, linked to it', async () => {
    const w = await withTickets();
    const adr = await ok(w.memberToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'ADR',
      title: 'Decision',
      ticket: w.mine.key,
    });
    expect(
      await ok(w.memberToken, 'get_document', { id: adr.id }),
    ).toMatchObject({
      kind: 'ADR',
      number: 1,
      status: 'PROPOSED',
      homeItem: null,
      items: [{ key: w.mine.key }],
    });
    const rows = await ok(w.memberToken, 'list_documents', {
      project: w.keyPrefix,
    });
    expect(rows).toMatchObject([
      { id: adr.id, kind: 'ADR', status: 'PROPOSED', createdFrom: w.mine.key },
    ]);
    // After that an ADR is for owners and managers.
    expect(
      await tool(w.memberToken, 'save_document', { id: adr.id, title: 'x' }),
    ).toEqual({ isError: true, text: FORBIDDEN });
  });

  it('refuses a ticket with a kind that cannot belong to one, and a Standard project', async () => {
    const w = await withTickets();
    const brief = await tool(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'BRIEF',
      title: 'Brief',
      ticket: w.mine.key,
    });
    expect(brief.isError).toBe(true);
    expect(brief.text).toMatch(/^invalid_input:/);

    const keyPrefix = freshPrefix();
    expect(
      (
        await api.send('POST', '/api/projects', w.owner.cookie, {
          name: 'S',
          keyPrefix,
          mode: 'STANDARD',
        })
      ).status,
    ).toBe(201);
    const task = await ok(w.ownerToken, 'save_item', {
      project: keyPrefix,
      kind: 'TASK',
      title: 'Task',
    });
    const standard = await tool(w.ownerToken, 'save_document', {
      project: keyPrefix,
      kind: 'SPEC',
      title: 'Spec',
      ticket: task.key,
    });
    expect(standard.isError).toBe(true);
    expect(standard.text).toMatch(/^guided_only:/);
    const adr = await tool(w.ownerToken, 'save_document', {
      project: keyPrefix,
      kind: 'ADR',
      title: 'ADR',
    });
    expect(adr.text).toMatch(/^guided_only:/);
    // Tech debt is raised from a ticket only.
    const debt = await tool(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'TECH_DEBT',
      title: 'Debt',
    });
    expect(debt.text).toMatch(/^raise_from_ticket:/);
  });

  it('needs project, kind and title to create, and refuses kind, ticket or status with an id', async () => {
    const w = await withTickets();
    expect(
      await tool(w.ownerToken, 'save_document', { project: w.keyPrefix }),
    ).toEqual({
      isError: true,
      text: 'invalid_input: Creating a document needs project, kind and title',
    });
    const created = await ok(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'BRIEF',
      title: 'Brief',
    });
    for (const extra of [
      { kind: 'SPEC' },
      { ticket: w.mine.key },
      { status: 'ACCEPTED' },
    ]) {
      const result = await tool(w.ownerToken, 'save_document', {
        id: created.id,
        title: 'x',
        ...extra,
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/^invalid_input:/);
    }
    const statusOnCreate = await tool(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'BRIEF',
      title: 'Brief',
      status: 'ACCEPTED',
    });
    expect(statusOnCreate.text).toMatch(/^invalid_input:/);
    // The ticket must be in the project named, so a wrong prefix never writes elsewhere.
    const otherProject = await tool(w.ownerToken, 'save_document', {
      project: 'NOPE',
      kind: 'SPEC',
      title: 'Spec',
      ticket: w.mine.key,
    });
    expect(otherProject.text).toMatch(/^invalid_input:/);
    // An empty id is a malformed id, not a create.
    const emptyId = await tool(w.ownerToken, 'save_document', {
      id: '',
      title: 'x',
    });
    expect(emptyId.text).toMatch(/^not_found:/);
    const long = await tool(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'BRIEF',
      title: 'x'.repeat(201),
    });
    expect(long.isError).toBe(true);
  });
  it('links/unlinks proposals idempotently and enforces existing ticket permissions', async () => {
    const w = await withTickets();
    const proposal = await ok(w.ownerToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'PROPOSAL',
      title: 'Proposal',
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(
        await ok(w.memberToken, 'link_document', {
          key: w.mine.key,
          id: proposal.id,
        }),
      ).toMatchObject({
        key: w.mine.key,
        documentId: proposal.id,
        linked: true,
      });
    }
    const item = await ok(w.memberToken, 'get_item', { key: w.mine.key });
    expect(item.related).toHaveLength(1);
    expect(item.related[0].url).toBe(
      `http://127.0.0.1:3013/p/${w.id}/docs/${proposal.id}`,
    );
    expect(item.assignee).toEqual({
      name: w.member.profile.name,
      email: w.member.profile.email,
    });
    expect(item.url).toBe(`http://127.0.0.1:3013/p/${w.id}/items/${item.id}`);
    expect(
      (
        await tool(w.memberToken, 'link_document', {
          key: w.theirs.key,
          id: proposal.id,
        })
      ).text,
    ).toMatch(/^forbidden:/);
    expect(
      (
        await tool(w.memberToken, 'unlink_document', {
          key: w.theirs.key,
          id: proposal.id,
        })
      ).text,
    ).toMatch(/^forbidden:/);
    const other = await withTickets();
    expect(
      (
        await tool(other.ownerToken, 'link_document', {
          key: other.mine.key,
          id: proposal.id,
        })
      ).text,
    ).toMatch(/^not_found:/);
    const spec = await ok(w.memberToken, 'save_document', {
      project: w.keyPrefix,
      kind: 'SPEC',
      title: 'Spec',
      ticket: w.mine.key,
    });
    expect(
      (
        await tool(w.memberToken, 'link_document', {
          key: w.mine.key,
          id: spec.id,
        })
      ).text,
    ).toMatch(/^not_found:/);
    expect(
      (
        await tool(w.memberToken, 'link_document', {
          key: w.mine.key,
          id: 'bad',
        })
      ).text,
    ).toMatch(/^not_found:/);
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(
        await ok(w.memberToken, 'unlink_document', {
          key: w.mine.key,
          id: proposal.id,
        }),
      ).toMatchObject({ linked: false });
    }
    expect(
      (await ok(w.memberToken, 'get_document', { id: proposal.id })).title,
    ).toBe('Proposal');
    await api.send('PATCH', `/api/documents/${proposal.id}`, w.owner.cookie, {
      archived: true,
    });
    expect(
      (
        await tool(w.ownerToken, 'link_document', {
          key: w.mine.key,
          id: proposal.id,
        })
      ).text,
    ).toMatch(/^document_archived:/);
    const standard = await read(
      await api.send('POST', '/api/projects', w.owner.cookie, {
        name: 'S',
        keyPrefix: freshPrefix(),
        mode: 'STANDARD',
      }),
    );
    const task = await ok(w.ownerToken, 'save_item', {
      project: standard.keyPrefix,
      kind: 'TASK',
      title: 'Task',
    });
    const reference = await ok(w.ownerToken, 'save_document', {
      project: standard.keyPrefix,
      kind: 'REFERENCE',
      title: 'Notes',
    });
    for (const name of ['link_document', 'unlink_document']) {
      expect(
        (await tool(w.ownerToken, name, { key: task.key, id: reference.id }))
          .text,
      ).toMatch(/^guided_only:/);
    }
  });

  it.each(['SLO', 'SLA'] as const)(
    '%s is project Knowledge through REST and MCP, without ticket ownership or status',
    async (kind) => {
      const w = await withTickets();
      const doc = await ok(w.ownerToken, 'save_document', {
        project: w.keyPrefix,
        kind,
        title: `${kind} draft`,
        body: '## Draft\nTargets and terms pending.',
      });
      expect(doc).toMatchObject({ kind, number: null, status: null });
      expect(doc.body).toBeUndefined();
      expect(
        (
          await ok(w.memberToken, 'list_documents', {
            project: w.keyPrefix,
            kind,
          })
        ).map((d: { id: string }) => d.id),
      ).toEqual([doc.id]);
      expect(
        await ok(w.memberToken, 'get_document', { id: doc.id }),
      ).toMatchObject({
        homeItemId: null,
        canArchive: true,
        body: expect.stringContaining('Draft'),
      });
      expect(
        (
          await tool(w.memberToken, 'save_document', {
            project: w.keyPrefix,
            kind,
            title: 'Member write',
          })
        ).text,
      ).toMatch(/^forbidden:/);
      expect(
        (
          await tool(w.memberToken, 'save_document', {
            id: doc.id,
            title: 'Member edit',
          })
        ).text,
      ).toMatch(/^forbidden:/);
      expect(
        (
          await tool(w.ownerToken, 'save_document', {
            project: w.keyPrefix,
            kind,
            title: 'Ticket home',
            ticket: w.mine.key,
          })
        ).text,
      ).toMatch(/^invalid_input:/);
      expect(
        (
          await api.send(
            'POST',
            `/api/items/${(await ok(w.ownerToken, 'get_item', { key: w.mine.key })).id}/documents/new`,
            w.owner.cookie,
            { kind, title: 'Ticket home' },
          )
        ).status,
      ).toBe(400);
      await ok(w.memberToken, 'link_document', { key: w.mine.key, id: doc.id });
      expect(
        (await ok(w.memberToken, 'get_item', { key: w.mine.key })).related,
      ).toMatchObject([{ id: doc.id, kind, home: 'project' }]);
      await ok(w.memberToken, 'unlink_document', {
        key: w.mine.key,
        id: doc.id,
      });
      expect(
        (
          await api.send(
            'POST',
            `/api/documents/${doc.id}/status`,
            w.owner.cookie,
            { status: 'ACCEPTED' },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await api.send('PATCH', `/api/documents/${doc.id}`, w.member.cookie, {
            archived: true,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await api.send('PATCH', `/api/documents/${doc.id}`, w.owner.cookie, {
            archived: true,
          })
        ).status,
      ).toBe(200);
      expect(
        await ok(w.memberToken, 'list_documents', {
          project: w.keyPrefix,
          kind,
        }),
      ).toEqual([]);
      expect(
        await ok(w.memberToken, 'list_documents', {
          project: w.keyPrefix,
          kind,
          archived: true,
        }),
      ).toMatchObject([{ id: doc.id, archived: true }]);
      const other = await setup();
      expect(
        (await tool(other.ownerToken, 'get_document', { id: doc.id })).text,
      ).toMatch(/^not_found:/);
      const keyPrefix = freshPrefix();
      const standard = await read(
        await api.send('POST', '/api/projects', w.owner.cookie, {
          name: 'Service',
          keyPrefix,
          mode: 'STANDARD',
        }),
      );
      const manager = await api.signInReady();
      expect(
        (
          await api.send(
            'POST',
            `/api/projects/${standard.id}/members`,
            w.owner.cookie,
            { email: manager.profile.email, role: 'MANAGER' },
          )
        ).status,
      ).toBe(201);
      const created = await api.send(
        'POST',
        `/api/projects/${standard.id}/documents`,
        manager.cookie,
        { kind, title: 'Standard objective or agreement' },
      );
      expect(created.status).toBe(201);
      const standardDoc = await read(created);
      expect(standardDoc).toMatchObject({
        kind,
        homeItemId: null,
        status: null,
        number: null,
      });
      expect(
        (
          await read(
            await api.send(
              'GET',
              `/api/projects/${standard.id}`,
              manager.cookie,
            ),
          )
        ).documentKinds,
      ).toContain(kind);
      expect(
        (
          await api.send(
            'PATCH',
            `/api/documents/${standardDoc.id}`,
            manager.cookie,
            { body: 'Edited by manager' },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await api.send(
            'GET',
            `/api/projects/${standard.id}/documents?kind=${kind}`,
            manager.cookie,
          )
        ).status,
      ).toBe(200);
    },
    60_000,
  );
});
