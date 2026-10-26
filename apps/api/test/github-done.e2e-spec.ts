import { createHmac, randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { MCP_RESOURCE, startTestApi, read } from './support/test-app.js';

const SECRET = 'github-test-secret';
process.env.GITHUB_WEBHOOK_SECRET = SECRET;

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');
const freshId = () => 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000);

interface ActivityRow {
  action: string;
  by: { name: string | null };
  agent: { name: string | null } | null;
  detail: {
    from?: string;
    to?: string;
    pullRequests?: { number: number; base: string; mergedBy: string | null }[];
    checksAfterMerge?: boolean;
    reasons?: string[];
  };
}

describe('github moves a ticket to Done on merge (e2e)', () => {
  let api: Awaited<ReturnType<typeof startTestApi>>;
  const deliveryIds: string[] = [];
  const installationIds: number[] = [];
  const projectIds: string[] = [];
  let clock = Date.parse('2026-10-01T10:00:00Z');

  beforeAll(async () => {
    api = await startTestApi();
  });

  afterAll(async () => {
    await prisma.githubDelivery.deleteMany({
      where: { id: { in: deliveryIds } },
    });
    await prisma.githubInstallation.deleteMany({
      where: { id: { in: installationIds } },
    });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${api.emailDomain}` } },
    });
    await prisma.$disconnect();
    await api?.close();
  });

  const sign = (body: string) =>
    `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

  /** Posts a signed webhook and applies every due delivery, as the worker would. */
  const accepted = async (
    event: string,
    payload: unknown,
    id = randomUUID(),
  ) => {
    deliveryIds.push(id);
    const body = JSON.stringify(payload);
    const res = await api.call('/api/github/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-github-delivery': id,
        'x-hub-signature-256': sign(body),
      },
      body,
    });
    expect(res.status).toBe(202);
    const { processNextGithubDelivery } =
      await import('@/modules/github/delivery.service.js');
    while (await processNextGithubDelivery());
  };

  /** A Guided project with the switch on, one mapped repo, and slices to try things on. */
  const setup = async (doneOnMerge = true) => {
    const owner = await api.signInReady();
    const prefix = freshPrefix();
    const project = (await read(
      await api.send('POST', '/api/projects', owner.cookie, {
        name: 'GD',
        keyPrefix: prefix,
        mode: 'GUIDED',
      }),
    )) as { id: string };
    projectIds.push(project.id);
    if (doneOnMerge)
      expect(
        (
          await api.send('PATCH', `/api/projects/${project.id}`, owner.cookie, {
            doneOnMerge: true,
          })
        ).status,
      ).toBe(200);
    const installationId = freshId();
    installationIds.push(installationId);
    const repo = { id: freshId(), full_name: 'acme/mapped' };
    await accepted('installation', {
      action: 'created',
      installation: { id: installationId, account: { login: 'acme' } },
      repositories: [repo],
    });
    expect(
      (
        await api.send(
          'PUT',
          `/api/projects/${project.id}/github/repositories/${repo.id}`,
          owner.cookie,
        )
      ).status,
    ).toBe(200);
    const states = await prisma.state.findMany({
      where: { projectId: project.id },
    });
    const feature = (await read(
      await api.send(
        'POST',
        `/api/projects/${project.id}/items`,
        owner.cookie,
        {
          kind: 'FEATURE',
          title: 'feature',
        },
      ),
    )) as { id: string };
    return {
      owner: owner.cookie,
      project: project.id,
      repo,
      states,
      feature: feature.id,
    };
  };
  type Setup = Awaited<ReturnType<typeof setup>>;

  /** A slice in the given state with three ticked checklist entries (or one unticked). */
  const slice = async (s: Setup, stateKey = 'in_review', ticked = true) => {
    const created = (await read(
      await api.send('POST', `/api/projects/${s.project}/items`, s.owner, {
        kind: 'SLICE',
        title: 'slice',
        parentId: s.feature,
      }),
    )) as { id: string; key: string };
    await prisma.checklistEntry.createMany({
      data: [1, 2, 3].map((position) => ({
        itemId: created.id,
        text: `entry ${position}`,
        done: ticked || position !== 3,
        position,
      })),
    });
    await prisma.item.update({
      where: { id: created.id },
      data: { stateId: s.states.find((state) => state.key === stateKey)!.id },
    });
    return created;
  };

  const stateKeyOf = async (itemId: string) =>
    (
      await prisma.item.findUniqueOrThrow({
        where: { id: itemId },
        select: { state: { select: { key: true } } },
      })
    ).state.key;

  const activity = async (s: Setup, itemId: string) =>
    read<ActivityRow[]>(
      await api.send('GET', `/api/items/${itemId}/activity`, s.owner),
    );

  const pr = (
    s: Setup,
    number: number,
    key: string,
    options: {
      head?: string;
      base?: string;
      merged?: boolean;
      closed?: boolean;
      by?: string;
    } = {},
  ) => ({
    action: options.merged || options.closed ? 'closed' : 'opened',
    repository: { id: s.repo.id },
    pull_request: {
      number,
      title: `feat: x (${key})`,
      body: '',
      html_url: `https://github.com/acme/mapped/pull/${number}`,
      state: options.merged || options.closed ? 'closed' : 'open',
      merged: options.merged ?? false,
      merged_at: options.merged ? new Date(clock).toISOString() : null,
      merged_by: options.merged ? { login: options.by ?? 'lead' } : null,
      user: { login: 'mya' },
      head: { ref: options.head ?? `branch-${number}`, sha: `sha${number}` },
      base: { ref: options.base ?? 'dev' },
      updated_at: new Date((clock += 1000)).toISOString(),
    },
  });

  const suite = (
    s: Setup,
    sha: string,
    status: string,
    conclusion: string | null,
    id = freshId(),
  ) => ({
    action: status === 'completed' ? 'completed' : 'requested',
    repository: { id: s.repo.id },
    check_suite: {
      id,
      head_sha: sha,
      status,
      conclusion,
      app: { name: 'CI' },
    },
  });

  it('moves an In Review ticket to Done when its PR merges into dev with green checks, recorded as GitHub', async () => {
    const s = await setup();
    const item = await slice(s);
    await accepted('pull_request', pr(s, 1, item.key));
    await accepted('check_suite', suite(s, 'sha1', 'completed', 'success'));
    expect(await stateKeyOf(item.id)).toBe('in_review');

    await accepted(
      'pull_request',
      pr(s, 1, item.key, { merged: true, by: 'lead' }),
    );

    expect(await stateKeyOf(item.id)).toBe('done');
    const row = (await activity(s, item.id)).find(
      (r) => r.action === 'item.move',
    )!;
    expect(row.by.name).toBe('GitHub');
    expect(row.agent).toEqual({ name: 'GitHub' });
    expect(row.detail).toMatchObject({
      from: 'In Review',
      to: 'Done',
      pullRequests: [{ number: 1, base: 'dev', mergedBy: 'lead' }],
      checksAfterMerge: false,
    });
    const stored = await prisma.activity.findFirstOrThrow({
      where: { itemId: item.id, action: 'item.move' },
    });
    expect(stored.userId).toBeNull();
    expect(stored.agentName).toBe('GitHub');
  });

  it('keeps the ticket in In Review and writes one github.done_skipped for a failed suite, an unticked item and an open blocker', async () => {
    const s = await setup();

    const failed = await slice(s);
    await accepted('pull_request', pr(s, 1, failed.key));
    await accepted('check_suite', suite(s, 'sha1', 'completed', 'failure'));
    await accepted('pull_request', pr(s, 1, failed.key, { merged: true }));
    // Later events for the same merge (another suite failing, a label) add no second row.
    await accepted('check_suite', suite(s, 'sha1', 'completed', 'failure'));
    await accepted('pull_request', pr(s, 1, failed.key, { merged: true }));

    const unticked = await slice(s, 'in_review', false);
    await accepted('pull_request', pr(s, 2, unticked.key));
    await accepted('pull_request', pr(s, 2, unticked.key, { merged: true }));

    const blocked = await slice(s);
    const blocker = await slice(s, 'in_progress');
    await prisma.itemBlock.create({
      data: { blockedId: blocked.id, blockerId: blocker.id },
    });
    await accepted('pull_request', pr(s, 3, blocked.key));
    await accepted('pull_request', pr(s, 3, blocked.key, { merged: true }));

    const expected = [
      [failed, 'Checks failed on PR #1'],
      [unticked, 'Tick every checklist entry first: "entry 3"'],
      [blocked, `Blocked by ${blocker.key}`],
    ] as const;
    for (const [item, reason] of expected) {
      expect(await stateKeyOf(item.id)).toBe('in_review');
      const skipped = (await activity(s, item.id)).filter(
        (r) => r.action === 'github.done_skipped',
      );
      expect(skipped).toHaveLength(1);
      expect(skipped[0].detail.reasons).toEqual([reason]);
      expect(skipped[0].by.name).toBe('GitHub');
    }
  });

  it('writes nothing while another branch is open or a check runs, then moves when the check completes green', async () => {
    const s = await setup();
    const open = await slice(s);
    await accepted('pull_request', pr(s, 1, open.key, { head: 'api' }));
    await accepted('pull_request', pr(s, 2, open.key, { head: 'web' }));
    await accepted('check_suite', suite(s, 'sha1', 'completed', 'success'));
    await accepted(
      'pull_request',
      pr(s, 1, open.key, { head: 'api', merged: true }),
    );
    expect(await stateKeyOf(open.id)).toBe('in_review');
    expect(await activity(s, open.id)).toHaveLength(1);

    // The other branch merges; its suite is still running.
    const suiteId = freshId();
    await accepted(
      'check_suite',
      suite(s, 'sha2', 'in_progress', null, suiteId),
    );
    await accepted(
      'pull_request',
      pr(s, 2, open.key, { head: 'web', merged: true }),
    );
    expect(await stateKeyOf(open.id)).toBe('in_review');
    expect(await activity(s, open.id)).toHaveLength(1);

    await accepted(
      'check_suite',
      suite(s, 'sha2', 'completed', 'success', suiteId),
    );
    expect(await stateKeyOf(open.id)).toBe('done');
    const rows = await activity(s, open.id);
    expect(rows.filter((r) => r.action === 'github.done_skipped')).toEqual([]);
    const move = rows.find((r) => r.action === 'item.move')!;
    expect(move.detail.checksAfterMerge).toBe(true);
    expect(move.detail.pullRequests).toHaveLength(2);
  });

  it('completes the work on the first merge of two PRs from one branch, and ignores a merge into another base', async () => {
    const s = await setup();
    const item = await slice(s);
    await accepted(
      'pull_request',
      pr(s, 1, item.key, { head: 'work', base: 'dev' }),
    );
    await accepted(
      'pull_request',
      pr(s, 2, item.key, { head: 'work', base: 'main' }),
    );
    await accepted(
      'pull_request',
      pr(s, 1, item.key, { head: 'work', base: 'dev', merged: true }),
    );
    expect(await stateKeyOf(item.id)).toBe('done');
    const moves = (await activity(s, item.id)).filter(
      (r) => r.action === 'item.move',
    );
    expect(moves).toHaveLength(1);

    // Moved back by a person, the main PR from the same branch merging later doesn't re-move it.
    const back = s.states.find((state) => state.key === 'in_review')!;
    await api.send('POST', `/api/items/${item.id}/move`, s.owner, {
      stateId: back.id,
    });
    await accepted(
      'pull_request',
      pr(s, 2, item.key, { head: 'work', base: 'main', merged: true }),
    );
    expect(await stateKeyOf(item.id)).toBe('in_review');

    const other = await slice(s);
    await accepted(
      'pull_request',
      pr(s, 3, other.key, { head: 'x', base: 'feature-x', merged: true }),
    );
    expect(await stateKeyOf(other.id)).toBe('in_review');
    expect(await activity(s, other.id)).toHaveLength(1);
  });

  it('moves nothing with the switch off, keeps Done people-only for agents, and does not re-move a ticket a person moved back', async () => {
    const off = await setup(false);
    const quiet = await slice(off);
    await accepted('pull_request', pr(off, 1, quiet.key));
    await accepted('pull_request', pr(off, 1, quiet.key, { merged: true }));
    expect(await stateKeyOf(quiet.id)).toBe('in_review');
    expect(await activity(off, quiet.id)).toHaveLength(1);

    const owner = await api.signInReady();
    const token = await api.uniauth.signAgentToken(
      owner.profile.sub,
      MCP_RESOURCE,
    );
    const project = (await read(
      await api.send('POST', '/api/projects', owner.cookie, {
        name: 'MC',
        keyPrefix: freshPrefix(),
        mode: 'GUIDED',
      }),
    )) as { id: string; keyPrefix: string };
    projectIds.push(project.id);
    const created = (await read(
      await api.send(
        'POST',
        `/api/projects/${project.id}/items`,
        owner.cookie,
        {
          kind: 'FEATURE',
          title: 'agent target',
        },
      ),
    )) as { key: string };
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
        params: {
          name: 'save_item',
          arguments: { key: created.key, state: 'Done' },
        },
      }),
    });
    const { result } = (await res.json()) as {
      result: { isError?: boolean; content: { text: string }[] };
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^people_only:/);

    const s = await setup();
    const item = await slice(s);
    await accepted('pull_request', pr(s, 1, item.key));
    const checks = suite(s, 'sha1', 'completed', 'success');
    await accepted('check_suite', checks);
    const merged = pr(s, 1, item.key, { merged: true });
    await accepted('pull_request', merged);
    expect(await stateKeyOf(item.id)).toBe('done');

    const back = s.states.find((state) => state.key === 'in_review')!;
    expect(
      (
        await api.send('POST', `/api/items/${item.id}/move`, s.owner, {
          stateId: back.id,
        })
      ).status,
    ).toBe(200);
    await accepted('check_suite', checks);
    await accepted('pull_request', merged);
    await accepted('check_suite', suite(s, 'sha1', 'completed', 'success'));
    expect(await stateKeyOf(item.id)).toBe('in_review');
  });
});
