import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { read, startTestApi } from './support/test-app.js';

type Doc = {
  id: string;
  sourceProposalId: string | null;
  sourceProposal: { id: string; archivedAt: string | null } | null;
  derivedSpecs: { id: string; homeItem: { id: string } | null }[];
  code?: string;
};

describe('spec provenance (e2e)', () => {
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
    await api.close();
  });
  const setup = async (mode: 'STANDARD' | 'GUIDED') => {
    const owner = await api.signInReady();
    const manager = await api.signInReady();
    const member = await api.signInReady();
    const outsider = await api.signInReady();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'Provenance',
      keyPrefix: Array.from({ length: 5 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      ).join(''),
      mode,
    });
    expect(created.status).toBe(201);
    const project = (await read(created)) as { id: string };
    for (const [person, role] of [
      [manager, 'MANAGER'],
      [member, 'MEMBER'],
    ] as const) {
      expect(
        (
          await api.send(
            'POST',
            `/api/projects/${project.id}/members`,
            owner.cookie,
            { email: person.profile.email, role },
          )
        ).status,
      ).toBe(201);
    }
    const me = await prisma.user.findUniqueOrThrow({
      where: { email: member.profile.email },
    });
    return {
      id: project.id,
      owner: owner.cookie,
      manager: manager.cookie,
      member: member.cookie,
      memberId: me.id,
      outsider: outsider.cookie,
    };
  };
  const create = async (
    projectId: string,
    cookie: string,
    data: Record<string, unknown>,
  ) => {
    const res = await api.send(
      'POST',
      `/api/projects/${projectId}/documents`,
      cookie,
      data,
    );
    return { status: res.status, doc: (await read(res)) as Doc };
  };
  const edit = async (
    id: string,
    cookie: string,
    data: Record<string, unknown>,
  ) => {
    const res = await api.send('PATCH', `/api/documents/${id}`, cookie, data);
    return { status: res.status, doc: (await read(res)) as Doc };
  };
  for (const mode of ['STANDARD', 'GUIDED'] as const) {
    it(`creates independent and multiple sourced specs in ${mode}; replaces, preserves and clears`, async () => {
      const w = await setup(mode);
      const p = (
        await create(w.id, w.owner, { kind: 'PROPOSAL', title: 'Source' })
      ).doc;
      const second = (
        await create(w.id, w.manager, {
          kind: 'PROPOSAL',
          title: 'Replacement',
        })
      ).doc;
      const independent = await create(w.id, w.owner, {
        kind: 'SPEC',
        title: 'Independent',
      });
      expect(independent.doc.sourceProposalId).toBeNull();
      const a = await create(w.id, w.manager, {
        kind: 'SPEC',
        title: 'A',
        sourceProposalId: p.id,
      });
      const b = await create(w.id, w.owner, {
        kind: 'SPEC',
        title: 'B',
        sourceProposalId: p.id,
      });
      expect(a.status).toBe(201);
      expect(a.doc.sourceProposal?.id).toBe(p.id);
      const source = (await read(
        await api.send('GET', `/api/documents/${p.id}`, w.member),
      )) as Doc;
      expect(source.derivedSpecs.map((s) => s.id)).toEqual([
        a.doc.id,
        b.doc.id,
      ]);
      expect(
        (await edit(a.doc.id, w.owner, { body: 'Preserve' })).doc
          .sourceProposalId,
      ).toBe(p.id);
      expect(
        (await edit(a.doc.id, w.owner, { sourceProposalId: second.id })).doc
          .sourceProposalId,
      ).toBe(second.id);
      expect(
        (await edit(a.doc.id, w.owner, { sourceProposalId: null })).doc
          .sourceProposal,
      ).toBeNull();
      expect(
        (await edit(a.doc.id, w.member, { sourceProposalId: p.id })).status,
      ).toBe(403);
      expect(
        (await edit(a.doc.id, w.outsider, { sourceProposalId: p.id })).status,
      ).toBe(404);
      const list = (await read(
        await api.send(
          'GET',
          `/api/projects/${w.id}/documents?kind=SPEC`,
          w.member,
        ),
      )) as Doc[];
      expect(list.find((d) => d.id === b.doc.id)?.sourceProposalId).toBe(p.id);
      expect(list[0]).not.toHaveProperty('derivedSpecs');
    });
  }
  it('rejects non-spec inputs and wrong sources without exposing foreign projects', async () => {
    const w = await setup('STANDARD');
    const other = await setup('STANDARD');
    const foreign = (
      await create(other.id, other.owner, {
        kind: 'REFERENCE',
        title: 'Foreign',
      })
    ).doc;
    const wrong = (
      await create(w.id, w.owner, { kind: 'REFERENCE', title: 'Wrong' })
    ).doc;
    for (const sourceProposalId of [null, wrong.id]) {
      expect(
        (
          await create(w.id, w.owner, {
            kind: 'SLO',
            title: 'Reject',
            sourceProposalId,
          })
        ).doc.code,
      ).toBe('invalid_source_proposal');
      expect(
        (await edit(wrong.id, w.owner, { sourceProposalId })).doc.code,
      ).toBe('invalid_source_proposal');
    }
    expect(
      (
        await create(w.id, w.owner, {
          kind: 'SPEC',
          title: 'Wrong',
          sourceProposalId: wrong.id,
        })
      ).doc.code,
    ).toBe('invalid_source_proposal');
    for (const sourceProposalId of [foreign.id, randomUUID()])
      expect(
        (
          await create(w.id, w.owner, {
            kind: 'SPEC',
            title: 'Hidden',
            sourceProposalId,
          })
        ).doc.code,
      ).toBe('not_found');
    expect(
      (
        await create(w.id, w.owner, {
          kind: 'SPEC',
          title: 'Malformed',
          sourceProposalId: 'bad',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await create(w.id, w.member, {
          kind: 'SPEC',
          title: 'Denied',
          sourceProposalId: foreign.id,
        })
      ).status,
    ).toBe(403);
  });
  it('keeps archived provenance readable and idempotent; rejects new archived associations', async () => {
    const w = await setup('STANDARD');
    const p = (
      await create(w.id, w.owner, { kind: 'PROPOSAL', title: 'Source' })
    ).doc;
    const a = (
      await create(w.id, w.owner, {
        kind: 'SPEC',
        title: 'A',
        sourceProposalId: p.id,
      })
    ).doc;
    await edit(p.id, w.owner, { archived: true });
    expect(
      (await edit(a.id, w.owner, { body: 'Still editable' })).doc.sourceProposal
        ?.archivedAt,
    ).not.toBeNull();
    expect((await edit(a.id, w.owner, { sourceProposalId: p.id })).status).toBe(
      200,
    );
    expect(
      (
        await create(w.id, w.owner, {
          kind: 'SPEC',
          title: 'New',
          sourceProposalId: p.id,
        })
      ).doc.code,
    ).toBe('document_archived');
    await edit(a.id, w.owner, { sourceProposalId: null });
    expect(
      (await edit(a.id, w.owner, { sourceProposalId: p.id })).doc.code,
    ).toBe('document_archived');
    await edit(p.id, w.owner, { archived: false });
    expect((await edit(a.id, w.owner, { sourceProposalId: p.id })).status).toBe(
      200,
    );
    await prisma.document.delete({ where: { id: p.id } });
    expect(
      (await edit(a.id, w.owner, { body: 'Source deleted' })).doc
        .sourceProposalId,
    ).toBeNull();
  });
  it('uses ticket permissions; hides deleted-home backlinks and preserves ticket state and links', async () => {
    const w = await setup('GUIDED');
    const p = (
      await create(w.id, w.owner, { kind: 'PROPOSAL', title: 'Source' })
    ).doc;
    const item = (await read(
      await api.send('POST', `/api/projects/${w.id}/items`, w.owner, {
        kind: 'FEATURE',
        title: 'Ticket',
        assigneeId: w.memberId,
      }),
    )) as { id: string; state: unknown };
    await api.send('POST', `/api/items/${item.id}/documents`, w.owner, {
      documentId: p.id,
    });
    const res = await api.send(
      'POST',
      `/api/items/${item.id}/documents/new`,
      w.member,
      { kind: 'SPEC', title: 'Ticket spec', sourceProposalId: p.id },
    );
    expect(res.status).toBe(201);
    const spec = (await read(res)) as Doc;
    expect(
      (await edit(spec.id, w.member, { sourceProposalId: null })).status,
    ).toBe(200);
    expect(
      (await edit(spec.id, w.manager, { sourceProposalId: p.id })).status,
    ).toBe(200);
    const before = await prisma.item.findUniqueOrThrow({
      where: { id: item.id },
      include: { documentLinks: true },
    });
    const source = (await read(
      await api.send('GET', `/api/documents/${p.id}`, w.member),
    )) as Doc;
    expect(source.derivedSpecs[0].homeItem?.id).toBe(item.id);
    await api.send('PATCH', `/api/items/${item.id}`, w.owner, {
      assigneeId: null,
    });
    expect(
      (await edit(spec.id, w.member, { sourceProposalId: null })).status,
    ).toBe(403);
    for (const kind of ['ADR', 'TECH_DEBT', 'REFERENCE']) {
      const refused = await api.send(
        'POST',
        `/api/items/${item.id}/documents/new`,
        w.owner,
        { kind, title: 'Reject', sourceProposalId: null },
      );
      expect(((await read(refused)) as Doc).code).toBe(
        'invalid_source_proposal',
      );
    }
    const after = await prisma.item.findUniqueOrThrow({
      where: { id: item.id },
      include: { documentLinks: true },
    });
    expect(after.stateId).toBe(before.stateId);
    expect(after.documentLinks).toEqual(before.documentLinks);
    await api.send('DELETE', `/api/items/${item.id}`, w.owner);
    const hidden = (await read(
      await api.send('GET', `/api/documents/${p.id}`, w.member),
    )) as Doc;
    expect(hidden.derivedSpecs).toEqual([]);
    expect(
      (await api.send('GET', `/api/documents/${spec.id}`, w.owner)).status,
    ).toBe(404);
    const standard = await setup('STANDARD');
    const task = (await read(
      await api.send(
        'POST',
        `/api/projects/${standard.id}/items`,
        standard.owner,
        { kind: 'TASK', title: 'Task' },
      ),
    )) as { id: string };
    expect(
      (
        await api.send(
          'POST',
          `/api/items/${task.id}/documents/new`,
          standard.owner,
          { kind: 'SPEC', title: 'No' },
        )
      ).status,
    ).toBe(409);
  });
});
