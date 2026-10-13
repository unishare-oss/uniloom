import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface InviteRow {
  token: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string;
  createdBy: string | null;
  state: string;
}

const HOUR = 3600 * 1000;

describe('invite links (e2e)', () => {
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

  /** A signed-in person: cookie, id and email. */
  const person = async () => {
    const { cookie, profile } = await api.signInReady();
    const me = (await read(await api.send('GET', '/api/me', cookie))) as {
      id: string;
    };
    return { cookie, id: me.id, email: profile.email };
  };

  /** A project owned by a new person, with helpers for the invite routes. */
  const setup = async () => {
    const owner = await person();
    const res = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'Invite test',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id } = (await read(res)) as { id: string };
    const path = `/api/projects/${id}/invite`;
    /** Adds a new person with `role` by email, as the owner. */
    const add = async (role: string) => {
      const p = await person();
      const added = await api.send(
        'POST',
        `/api/projects/${id}/members`,
        owner.cookie,
        { email: p.email, role },
      );
      expect(added.status).toBe(201);
      return p;
    };
    const create = (
      cookie: string,
      body: unknown = { expiresIn: '24h', maxUses: null },
    ) => api.send('POST', path, cookie, body);
    /** A new link made by the owner. */
    const link = async (body?: unknown) =>
      (await read(await create(owner.cookie, body))) as InviteRow;
    const roles = async () => {
      const rows = (await read(
        await api.send('GET', `/api/projects/${id}/members`, owner.cookie),
      )) as { userId: string; role: string }[];
      return Object.fromEntries(rows.map((r) => [r.userId, r.role]));
    };
    return { owner, id, path, add, create, link, roles };
  };

  const preview = (cookie: string, token: string) =>
    api.send('GET', `/api/invites/${token}`, cookie);
  const join = (cookie: string, token: string) =>
    api.send('POST', `/api/invites/${token}/join`, cookie);

  it('lets an owner and a manager create a link; a member gets 403, a stranger 404', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const member = await w.add('MEMBER');
    const stranger = await person();

    const before = Date.now();
    const created = await w.create(w.owner.cookie);
    expect(created.status).toBe(201);
    const invite = (await read(created)) as InviteRow;
    expect(invite).toMatchObject({
      maxUses: null,
      useCount: 0,
      state: 'live',
    });
    expect(invite.createdBy).toBeTruthy();
    // 32 random bytes as base64url.
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const expires = new Date(invite.expiresAt).getTime();
    expect(expires).toBeGreaterThanOrEqual(before + 24 * HOUR - 1000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 24 * HOUR + 1000);

    expect((await w.create(manager.cookie)).status).toBe(201);

    const denied = await Promise.all([
      w.create(member.cookie),
      api.send('GET', w.path, member.cookie),
      api.send('DELETE', w.path, member.cookie),
    ]);
    expect(denied.map((r) => r.status)).toEqual([403, 403, 403]);
    expect(await read(denied[0]!)).toMatchObject({ code: 'forbidden' });

    const hidden = await Promise.all([
      w.create(stranger.cookie),
      api.send('GET', w.path, stranger.cookie),
      api.send('DELETE', w.path, stranger.cookie),
      api.send('GET', `/api/projects/${randomUUID()}/invite`, w.owner.cookie),
    ]);
    expect(hidden.map((r) => r.status)).toEqual([404, 404, 404, 404]);
  });

  it('computes the expiry from the chosen option', async () => {
    const w = await setup();
    for (const [expiresIn, hours] of [
      ['1h', 1],
      ['7d', 7 * 24],
      ['30d', 30 * 24],
    ] as const) {
      const invite = await w.link({ expiresIn, maxUses: 5 });
      const left = new Date(invite.expiresAt).getTime() - Date.now();
      expect(Math.abs(left - hours * HOUR)).toBeLessThan(5000);
      expect(invite.maxUses).toBe(5);
    }
  });

  it('refuses an unknown expiry and a limit outside 1 to 100', async () => {
    const w = await setup();
    const responses = await Promise.all([
      w.create(w.owner.cookie, { expiresIn: '90d', maxUses: null }),
      w.create(w.owner.cookie, { expiresIn: '24h', maxUses: 0 }),
      w.create(w.owner.cookie, { expiresIn: '24h', maxUses: 101 }),
      w.create(w.owner.cookie, { expiresIn: '24h', maxUses: 1.5 }),
      w.create(w.owner.cookie, { expiresIn: '24h' }),
      // A client can't pick its own date.
      w.create(w.owner.cookie, {
        expiresIn: '24h',
        maxUses: null,
        expiresAt: '2099-01-01T00:00:00Z',
      }),
    ]);
    expect(responses.slice(0, 5).map((r) => r.status)).toEqual([
      400, 400, 400, 400, 400,
    ]);
    expect(await read(responses[0]!)).toMatchObject({ code: 'invalid_input' });
    const sneaky = (await read(responses[5]!)) as InviteRow;
    expect(new Date(sneaky.expiresAt).getTime()).toBeLessThan(
      Date.now() + 25 * HOUR,
    );
  });

  it('returns the current link, or null when there is none', async () => {
    const w = await setup();
    const none = await api.send('GET', w.path, w.owner.cookie);
    expect(none.status).toBe(200);
    expect(await read(none)).toBeNull();

    const invite = await w.link({ expiresIn: '7d', maxUses: 10 });
    expect(await read(await api.send('GET', w.path, w.owner.cookie))).toEqual(
      invite,
    );
  });

  it('replaces the link: the old one stops working at once', async () => {
    const w = await setup();
    const visitor = await person();
    const first = await w.link();
    const second = await w.link();
    expect(second.token).not.toBe(first.token);

    const old = await preview(visitor.cookie, first.token);
    expect(old.status).toBe(404);
    expect(await read(old)).toMatchObject({ code: 'invite_not_found' });
    expect((await join(visitor.cookie, first.token)).status).toBe(404);
    expect((await preview(visitor.cookie, second.token)).status).toBe(200);
    expect(
      await prisma.invite.count({
        where: { projectId: w.id, revokedAt: null },
      }),
    ).toBe(1);
  });

  it('keeps one live link when two people create at the same time', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const responses = await Promise.all([
      w.create(w.owner.cookie),
      w.create(manager.cookie),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(
      await prisma.invite.count({
        where: { projectId: w.id, revokedAt: null },
      }),
    ).toBe(1);
  });

  it('deletes the link, and deleting again is fine', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link();

    const deleted = await api.send('DELETE', w.path, w.owner.cookie);
    expect(deleted.status).toBe(200);
    expect(
      await read(await api.send('GET', w.path, w.owner.cookie)),
    ).toBeNull();
    expect((await preview(visitor.cookie, invite.token)).status).toBe(404);
    expect((await api.send('DELETE', w.path, w.owner.cookie)).status).toBe(200);
  });

  it('previews the project and who invited, without joining', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link();

    const res = await preview(visitor.cookie, invite.token);
    expect(res.status).toBe(200);
    expect(await read(res)).toEqual({
      projectId: w.id,
      projectName: 'Invite test',
      invitedBy: invite.createdBy,
      isMember: false,
      joinApproval: false,
      request: null,
    });
    expect(await w.roles()).not.toHaveProperty(visitor.id);
    expect(
      (await read(await api.send('GET', w.path, w.owner.cookie))).useCount,
    ).toBe(0);
  });

  it('joins as a Member and uses one slot', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ expiresIn: '24h', maxUses: 3 });

    const res = await join(visitor.cookie, invite.token);
    expect(res.status).toBe(200);
    expect(await read(res)).toEqual({ result: 'joined', projectId: w.id });
    expect((await w.roles())[visitor.id]).toBe('MEMBER');
    expect(
      (await read(await api.send('GET', w.path, w.owner.cookie))).useCount,
    ).toBe(1);
    expect(
      (await api.send('GET', `/api/projects/${w.id}`, visitor.cookie)).status,
    ).toBe(200);
  });

  it('gives a member the project back and uses no slot', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ expiresIn: '24h', maxUses: 3 });
    await join(visitor.cookie, invite.token);

    const again = await join(visitor.cookie, invite.token);
    expect(again.status).toBe(200);
    expect(await read(again)).toEqual({ result: 'joined', projectId: w.id });
    const ownerJoins = await join(w.owner.cookie, invite.token);
    expect(ownerJoins.status).toBe(200);
    expect((await w.roles())[w.owner.id]).toBe('OWNER');
    expect(
      (await read(await api.send('GET', w.path, w.owner.cookie))).useCount,
    ).toBe(1);
    expect(
      await read(await preview(visitor.cookie, invite.token)),
    ).toMatchObject({ isMember: true });
  });

  it('answers 410 invite_expired on an expired link, without the project name', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link();
    await prisma.invite.update({
      where: { token: invite.token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    for (const res of [
      await preview(visitor.cookie, invite.token),
      await join(visitor.cookie, invite.token),
    ]) {
      expect(res.status).toBe(410);
      const body = await read(res);
      expect(body).toMatchObject({ code: 'invite_expired' });
      expect(JSON.stringify(body)).not.toContain('Invite test');
    }
    expect(await w.roles()).not.toHaveProperty(visitor.id);
    // The card still shows it, as expired, until someone replaces it.
    expect(
      await read(await api.send('GET', w.path, w.owner.cookie)),
    ).toMatchObject({ token: invite.token, state: 'expired' });
  });

  it('answers 409 invite_full once every slot is used', async () => {
    const w = await setup();
    const first = await person();
    const second = await person();
    const invite = await w.link({ expiresIn: '24h', maxUses: 1 });
    expect((await join(first.cookie, invite.token)).status).toBe(200);

    for (const res of [
      await preview(second.cookie, invite.token),
      await join(second.cookie, invite.token),
    ]) {
      expect(res.status).toBe(409);
      const body = await read(res);
      expect(body).toMatchObject({ code: 'invite_full' });
      expect(JSON.stringify(body)).not.toContain('Invite test');
    }
    expect(await w.roles()).not.toHaveProperty(second.id);
    expect(
      await read(await api.send('GET', w.path, w.owner.cookie)),
    ).toMatchObject({ useCount: 1, state: 'full' });
  });

  it('sends a member to the project even when the link is expired or full', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ expiresIn: '24h', maxUses: 1 });
    await join(visitor.cookie, invite.token);
    await prisma.invite.update({
      where: { token: invite.token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(
      await read(await preview(visitor.cookie, invite.token)),
    ).toMatchObject({ projectId: w.id, isMember: true });
    expect(await read(await join(visitor.cookie, invite.token))).toEqual({
      result: 'joined',
      projectId: w.id,
    });
  });

  it('lets exactly one of two people take the last slot', async () => {
    const w = await setup();
    const [a, b] = [await person(), await person()];
    const invite = await w.link({ expiresIn: '24h', maxUses: 1 });

    const responses = await Promise.all([
      join(a.cookie, invite.token),
      join(b.cookie, invite.token),
    ]);
    expect(responses.map((r) => r.status).sort((x, y) => x - y)).toEqual([
      200, 409,
    ]);
    const roles = await w.roles();
    expect([a.id, b.id].filter((id) => roles[id]).length).toBe(1);
    expect(
      (await read(await api.send('GET', w.path, w.owner.cookie))).useCount,
    ).toBe(1);
  });

  it('uses one slot when the same person presses Join twice at once', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ expiresIn: '24h', maxUses: 5 });

    const responses = await Promise.all([
      join(visitor.cookie, invite.token),
      join(visitor.cookie, invite.token),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (await read(await api.send('GET', w.path, w.owner.cookie))).useCount,
    ).toBe(1);
  });

  it('answers 404 invite_not_found for a token that never existed', async () => {
    const visitor = await person();
    for (const res of [
      await preview(visitor.cookie, 'no-such-token'),
      await join(visitor.cookie, 'no-such-token'),
    ]) {
      expect(res.status).toBe(404);
      expect(await read(res)).toMatchObject({ code: 'invite_not_found' });
    }
  });

  it('needs a session and consent like every feature route', async () => {
    const w = await setup();
    const invite = await w.link();
    expect((await api.call(`/api/invites/${invite.token}`)).status).toBe(401);
    const { cookie } = await api.signIn(api.newProfile());
    const res = await preview(cookie, invite.token);
    expect(res.status).toBe(403);
    expect(await read(res)).toMatchObject({ code: 'consent_required' });
  });

  it('keeps the link working after its creator leaves the project', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const visitor = await person();
    const invite = (await read(await w.create(manager.cookie))) as InviteRow;
    await api.send(
      'DELETE',
      `/api/projects/${w.id}/members/${manager.id}`,
      manager.cookie,
    );

    expect((await join(visitor.cookie, invite.token)).status).toBe(200);
    expect((await w.roles())[visitor.id]).toBe('MEMBER');
  });

  it('tells owners and managers they may invite', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const member = await w.add('MEMBER');
    const canInvite = async (cookie: string) =>
      (await read(await api.send('GET', `/api/projects/${w.id}`, cookie)))
        .canInvite;
    expect(await canInvite(w.owner.cookie)).toBe(true);
    expect(await canInvite(manager.cookie)).toBe(true);
    expect(await canInvite(member.cookie)).toBe(false);
  });
});
