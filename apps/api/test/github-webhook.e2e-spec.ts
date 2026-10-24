import { createHmac, randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const SECRET = 'github-test-secret';
process.env.GITHUB_WEBHOOK_SECRET = SECRET;

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');
const freshId = () => 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000);

interface PullRequestRow {
  number: number;
  title: string;
  state: string;
  checks: string;
  mergedByLogin: string | null;
  closes: boolean;
  repository: string;
}

describe('github webhook (e2e)', () => {
  let api: Awaited<ReturnType<typeof startTestApi>>;
  const deliveryIds: string[] = [];
  const installationIds: number[] = [];
  const projectIds: string[] = [];

  beforeAll(async () => {
    api = await startTestApi();
  });

  afterAll(async () => {
    await prisma.githubDelivery.deleteMany({
      where: { id: { in: deliveryIds } },
    });
    // Repos cascade to their pull requests, check suites and mappings.
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

  /** Posts a signed webhook; returns the response and the delivery id used. */
  const deliver = async (
    event: string,
    payload: unknown,
    options: { id?: string; signature?: string } = {},
  ) => {
    const id = options.id ?? randomUUID();
    deliveryIds.push(id);
    const body = JSON.stringify(payload);
    const res = await api.call('/api/github/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-github-delivery': id,
        'x-hub-signature-256': options.signature ?? sign(body),
      },
      body,
    });
    return { res, id };
  };

  /** Applies every due delivery, as the worker would. */
  const drain = async () => {
    const { processNextGithubDelivery } =
      await import('@/modules/github/delivery.service.js');
    while (await processNextGithubDelivery());
  };

  const accepted = async (event: string, payload: unknown) => {
    const { res } = await deliver(event, payload);
    expect(res.status).toBe(202);
    await drain();
  };

  /** An owner, a manager and an outsider; a project with two tasks and an App installation with two repos. */
  const setup = async () => {
    const owner = await api.signInReady();
    const prefix = freshPrefix();
    const project = (await read(
      await api.send('POST', '/api/projects', owner.cookie, {
        name: 'GH',
        keyPrefix: prefix,
        mode: 'STANDARD',
      }),
    )) as { id: string };
    projectIds.push(project.id);
    const manager = await api.signInReady();
    expect(
      (
        await api.send(
          'POST',
          `/api/projects/${project.id}/members`,
          owner.cookie,
          { email: manager.profile.email, role: 'MANAGER' },
        )
      ).status,
    ).toBe(201);
    const outsider = await api.signInReady();
    const tasks: { id: string; key: string }[] = [];
    for (const title of ['one', 'two']) {
      tasks.push(
        (await read(
          await api.send(
            'POST',
            `/api/projects/${project.id}/items`,
            owner.cookie,
            { kind: 'TASK', title },
          ),
        )) as { id: string; key: string },
      );
    }
    const installationId = freshId();
    installationIds.push(installationId);
    const mappedRepo = { id: freshId(), full_name: 'acme/mapped' };
    const otherRepo = { id: freshId(), full_name: 'acme/other' };
    await accepted('installation', {
      action: 'created',
      installation: { id: installationId, account: { login: 'acme' } },
      repositories: [mappedRepo, otherRepo],
    });
    const mapped = await api.send(
      'PUT',
      `/api/projects/${project.id}/github/repositories/${mappedRepo.id}`,
      owner.cookie,
    );
    expect(mapped.status).toBe(200);
    return {
      owner: owner.cookie,
      manager: manager.cookie,
      outsider: outsider.cookie,
      project: project.id,
      prefix,
      tasks,
      installationId,
      mappedRepo,
      otherRepo,
    };
  };

  const prPayload = (
    repoId: number,
    overrides: Record<string, unknown> = {},
    updatedAt = '2026-10-01T10:00:00Z',
  ) => ({
    action: 'opened',
    repository: { id: repoId },
    pull_request: {
      number: 7,
      title: 'feat: x',
      body: '',
      html_url: 'https://github.com/acme/mapped/pull/7',
      state: 'open',
      merged: false,
      merged_at: null,
      merged_by: null,
      user: { login: 'mya' },
      head: { ref: 'feature', sha: 'abc123' },
      base: { ref: 'main' },
      updated_at: updatedAt,
      ...overrides,
    },
  });

  const listPullRequests = async (cookie: string, itemId: string) =>
    read<PullRequestRow[]>(
      await api.send('GET', `/api/items/${itemId}/pull-requests`, cookie),
    );

  it('rejects a missing or wrong signature and applies a repeated delivery once', async () => {
    const s = await setup();
    const payload = prPayload(s.mappedRepo.id, {
      title: `feat: x (${s.tasks[0].key})`,
    });

    const unsigned = await api.call('/api/github/webhook', {
      method: 'POST',
      headers: { 'x-github-event': 'ping', 'x-github-delivery': 'no-sig' },
      body: JSON.stringify(payload),
    });
    expect(unsigned.status).toBe(401);
    const wrong = await deliver('pull_request', payload, {
      signature: sign('something else'),
    });
    expect(wrong.res.status).toBe(401);
    expect(
      await prisma.githubDelivery.count({
        where: { id: { in: [wrong.id, 'no-sig'] } },
      }),
    ).toBe(0);

    const first = await deliver('pull_request', payload);
    const again = await deliver('pull_request', payload, { id: first.id });
    expect(first.res.status).toBe(202);
    expect(again.res.status).toBe(202);
    expect(await prisma.githubDelivery.count({ where: { id: first.id } })).toBe(
      1,
    );
    await drain();
    expect(
      await prisma.pullRequestItem.count({ where: { itemId: s.tasks[0].id } }),
    ).toBe(1);
    expect(await listPullRequests(s.owner, s.tasks[0].id)).toHaveLength(1);
  });

  it('links a PR in a mapped repo to the ticket named in its title, and nothing else', async () => {
    const s = await setup();
    await accepted(
      'pull_request',
      prPayload(s.mappedRepo.id, {
        title: `feat: x (${s.tasks[0].key})`,
        number: 1,
      }),
    );
    await accepted('check_suite', {
      action: 'completed',
      repository: { id: s.mappedRepo.id },
      check_suite: {
        id: freshId(),
        head_sha: 'abc123',
        status: 'completed',
        conclusion: 'success',
        app: { name: 'CI' },
      },
    });
    // Same PR shape in the unmapped repo, and a PR in the mapped repo with no key.
    await accepted(
      'pull_request',
      prPayload(s.otherRepo.id, {
        title: `feat: x (${s.tasks[0].key})`,
        number: 2,
      }),
    );
    await accepted('pull_request', prPayload(s.mappedRepo.id, { number: 3 }));

    const rows = await listPullRequests(s.owner, s.tasks[0].id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      number: 1,
      title: `feat: x (${s.tasks[0].key})`,
      state: 'OPEN',
      checks: 'success',
      closes: true,
      repository: 'acme/mapped',
    });
    expect(await listPullRequests(s.owner, s.tasks[1].id)).toEqual([]);
    expect(
      await prisma.pullRequest.count({
        where: { repositoryId: s.otherRepo.id },
      }),
    ).toBe(0);
    expect(
      (
        await api.send(
          'GET',
          `/api/items/${s.tasks[0].id}/pull-requests`,
          s.outsider,
        )
      ).status,
    ).toBe(404);
  });

  it('updates state and checks from later events, ignores older ones, and links keys added by an edit', async () => {
    const s = await setup();
    const title = `fix (${s.tasks[0].key})`;
    await accepted(
      'pull_request',
      prPayload(s.mappedRepo.id, { title }, '2026-10-01T10:00:00Z'),
    );
    await accepted(
      'pull_request',
      prPayload(
        s.mappedRepo.id,
        {
          title,
          state: 'closed',
          merged: true,
          merged_at: '2026-10-01T11:00:00Z',
          merged_by: { login: 'ko' },
        },
        '2026-10-01T11:00:00Z',
      ),
    );
    // An older "opened" arrives late.
    await accepted(
      'pull_request',
      prPayload(s.mappedRepo.id, { title }, '2026-10-01T10:30:00Z'),
    );
    let [row] = await listPullRequests(s.owner, s.tasks[0].id);
    expect(row.state).toBe('MERGED');
    expect(row.mergedByLogin).toBe('ko');

    const suite = (id: number, conclusion: string) => ({
      action: 'completed',
      repository: { id: s.mappedRepo.id },
      check_suite: {
        id,
        head_sha: 'abc123',
        status: 'completed',
        conclusion,
        app: { name: 'CI' },
      },
    });
    const suiteId = freshId();
    await accepted('check_suite', suite(suiteId, 'failure'));
    [row] = await listPullRequests(s.owner, s.tasks[0].id);
    expect(row.checks).toBe('failure');
    await accepted('check_suite', suite(suiteId, 'success'));
    [row] = await listPullRequests(s.owner, s.tasks[0].id);
    expect(row.checks).toBe('success');
    // A late "requested" keeps the result; a re-run starts the suite again.
    const restarted = (action: string) => ({
      ...suite(suiteId, 'success'),
      action,
      check_suite: {
        ...suite(suiteId, 'success').check_suite,
        status: 'queued',
        conclusion: null,
      },
    });
    await accepted('check_suite', restarted('requested'));
    [row] = await listPullRequests(s.owner, s.tasks[0].id);
    expect(row.checks).toBe('success');
    await accepted('check_suite', restarted('rerequested'));
    [row] = await listPullRequests(s.owner, s.tasks[0].id);
    expect(row.checks).toBe('pending');
    await accepted('check_suite', suite(suiteId, 'success'));

    expect(await listPullRequests(s.owner, s.tasks[1].id)).toEqual([]);
    await accepted(
      'pull_request',
      prPayload(
        s.mappedRepo.id,
        {
          action: 'edited',
          title,
          state: 'closed',
          merged: true,
          merged_by: { login: 'ko' },
          body: `Closes [${s.tasks[1].key}](https://example.com/${s.tasks[1].key})`,
        },
        '2026-10-01T12:00:00Z',
      ),
    );
    const second = await listPullRequests(s.owner, s.tasks[1].id);
    expect(second).toHaveLength(1);
    expect(second[0].closes).toBe(true);
    expect(await listPullRequests(s.owner, s.tasks[0].id)).toHaveLength(1);
  });

  it('lets only an Owner map repos, only live ones, and stops linking after the installation is deleted', async () => {
    const s = await setup();
    const listUrl = `/api/projects/${s.project}/github/repositories`;
    const url = (repo: number | string) => `${listUrl}/${repo}`;

    expect((await api.send('PUT', url(s.otherRepo.id), s.manager)).status).toBe(
      403,
    );
    expect(
      (await api.send('DELETE', url(s.mappedRepo.id), s.manager)).status,
    ).toBe(403);
    expect(
      (await api.send('PUT', url(s.otherRepo.id), s.outsider)).status,
    ).toBe(404);
    expect((await api.send('GET', listUrl, s.manager)).status).toBe(403);

    const list = await read<{
      installUrl: string | null;
      repositories: { id: string; fullName: string; mapped: boolean }[];
    }>(await api.send('GET', listUrl, s.owner));
    expect(
      list.repositories.find((r) => r.id === String(s.otherRepo.id)),
    ).toMatchObject({ mapped: false });
    expect(
      list.repositories.find((r) => r.id === String(s.mappedRepo.id)),
    ).toMatchObject({ mapped: true });

    // A repo that is not known, and one removed from the installation.
    expect((await api.send('PUT', url(freshId()), s.owner)).status).toBe(404);
    await accepted('installation_repositories', {
      action: 'removed',
      installation: { id: s.installationId, account: { login: 'acme' } },
      repositories_removed: [{ id: s.otherRepo.id }],
    });
    expect((await api.send('PUT', url(s.otherRepo.id), s.owner)).status).toBe(
      404,
    );

    // Unmap and map again.
    expect(
      (await api.send('DELETE', url(s.mappedRepo.id), s.owner)).status,
    ).toBe(200);
    expect((await api.send('PUT', url(s.mappedRepo.id), s.owner)).status).toBe(
      200,
    );

    await accepted('installation', {
      action: 'deleted',
      installation: { id: s.installationId, account: { login: 'acme' } },
    });
    await accepted(
      'pull_request',
      prPayload(s.mappedRepo.id, { title: `new (${s.tasks[0].key})` }),
    );
    expect(await listPullRequests(s.owner, s.tasks[0].id)).toEqual([]);
    expect((await api.send('PUT', url(s.mappedRepo.id), s.owner)).status).toBe(
      404,
    );
  });
});
