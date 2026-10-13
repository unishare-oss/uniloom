import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface InviteRow {
  token: string;
  useCount: number;
  joinApproval: boolean;
  state: string;
}

interface RequestRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  requestedAt: string;
}

describe('join requests (e2e)', () => {
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

  /** A project owned by a new person, with helpers for links and requests. */
  const setup = async () => {
    const owner = await person();
    const res = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'Approval test',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id } = (await read(res)) as { id: string };
    const invitePath = `/api/projects/${id}/invite`;
    const path = `/api/projects/${id}/join-requests`;
    /** Adds a person by email, as the owner. */
    const addByEmail = (email: string, role = 'MEMBER') =>
      api.send('POST', `/api/projects/${id}/members`, owner.cookie, {
        email,
        role,
      });
    const add = async (role: string) => {
      const p = await person();
      expect((await addByEmail(p.email, role)).status).toBe(201);
      return p;
    };
    /** A new link made by the owner: needs approval unless told otherwise. */
    const link = async (body: Record<string, unknown> = {}) =>
      (await read(
        await api.send('POST', invitePath, owner.cookie, {
          expiresIn: '24h',
          maxUses: null,
          joinApproval: true,
          ...body,
        }),
      )) as InviteRow;
    const current = async () =>
      (await read(
        await api.send('GET', invitePath, owner.cookie),
      )) as InviteRow;
    const list = async (cookie = owner.cookie) =>
      (await read(await api.send('GET', path, cookie))) as RequestRow[];
    const decide = (cookie: string, requestId: string, what: string) =>
      api.send('POST', `${path}/${requestId}/${what}`, cookie);
    const roles = async () => {
      const rows = (await read(
        await api.send('GET', `/api/projects/${id}/members`, owner.cookie),
      )) as { userId: string; role: string }[];
      return Object.fromEntries(rows.map((r) => [r.userId, r.role]));
    };
    const count = async (cookie = owner.cookie) =>
      (await read(await api.send('GET', `/api/projects/${id}`, cookie)))
        .joinRequestCount as number;
    return {
      owner,
      id,
      path,
      addByEmail,
      add,
      link,
      current,
      list,
      decide,
      roles,
      count,
    };
  };

  const preview = (cookie: string, token: string) =>
    api.send('GET', `/api/invites/${token}`, cookie);
  const join = (cookie: string, token: string) =>
    api.send('POST', `/api/invites/${token}/join`, cookie);

  it('creates an approval link, and an open one by default', async () => {
    const w = await setup();
    expect((await w.link()).joinApproval).toBe(true);
    expect((await w.current()).joinApproval).toBe(true);
    expect((await w.link({ joinApproval: false })).joinApproval).toBe(false);
    const res = await api.send(
      'POST',
      `/api/projects/${w.id}/invite`,
      w.owner.cookie,
      { expiresIn: '24h', maxUses: null },
    );
    expect(((await read(res)) as InviteRow).joinApproval).toBe(false);
  });

  it('asks instead of joining on an approval link, and uses a slot', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ maxUses: 5 });

    expect(await read(await preview(visitor.cookie, invite.token))).toEqual({
      projectId: w.id,
      projectName: 'Approval test',
      invitedBy: expect.any(String),
      isMember: false,
      joinApproval: true,
      request: null,
      requestId: null,
    });

    const res = await join(visitor.cookie, invite.token);
    expect(res.status).toBe(200);
    expect(await read(res)).toEqual({ result: 'requested', projectId: w.id });
    expect(await w.roles()).not.toHaveProperty(visitor.id);
    expect(
      (await api.send('GET', `/api/projects/${w.id}`, visitor.cookie)).status,
    ).toBe(404);
    expect((await w.current()).useCount).toBe(1);
    expect(
      await read(await preview(visitor.cookie, invite.token)),
    ).toMatchObject({ isMember: false, request: 'PENDING' });

    const rows = await w.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: visitor.id,
      email: visitor.email,
      image: null,
    });
    expect(rows[0]).toHaveProperty('name');
    expect(Date.parse(rows[0]!.requestedAt)).toBeGreaterThan(
      Date.now() - 60_000,
    );
  });

  it('keeps one request and one slot when the same person asks twice', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ maxUses: 5 });

    await join(visitor.cookie, invite.token);
    const again = await join(visitor.cookie, invite.token);
    expect(await read(again)).toEqual({ result: 'requested', projectId: w.id });
    const both = await Promise.all([
      join(visitor.cookie, invite.token),
      join(visitor.cookie, invite.token),
    ]);
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(await w.list()).toHaveLength(1);
    expect((await w.current()).useCount).toBe(1);
  });

  it('uses one slot when a new person presses Ask to join twice at once', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ maxUses: 5 });
    const both = await Promise.all([
      join(visitor.cookie, invite.token),
      join(visitor.cookie, invite.token),
    ]);
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(await w.list()).toHaveLength(1);
    expect((await w.current()).useCount).toBe(1);
  });

  it('lists requests oldest first, for owners and managers only', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const member = await w.add('MEMBER');
    const [first, second, stranger] = [
      await person(),
      await person(),
      await person(),
    ];
    const invite = await w.link();
    await join(first.cookie, invite.token);
    await join(second.cookie, invite.token);

    expect((await w.list()).map((r) => r.userId)).toEqual([
      first.id,
      second.id,
    ]);
    expect((await w.list(manager.cookie)).map((r) => r.userId)).toEqual([
      first.id,
      second.id,
    ]);
    const requestId = (await w.list())[0]!.id;
    const denied = await Promise.all([
      api.send('GET', w.path, member.cookie),
      w.decide(member.cookie, requestId, 'approve'),
      w.decide(member.cookie, requestId, 'decline'),
    ]);
    expect(denied.map((r) => r.status)).toEqual([403, 403, 403]);
    const hidden = await Promise.all([
      api.send('GET', w.path, stranger.cookie),
      w.decide(stranger.cookie, requestId, 'approve'),
      // The requester can't approve themselves.
      w.decide(first.cookie, requestId, 'approve'),
    ]);
    expect(hidden.map((r) => r.status)).toEqual([404, 404, 404]);
    expect(await w.list()).toHaveLength(2);
  });

  it('counts waiting requests on the project for owners and managers', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const member = await w.add('MEMBER');
    const invite = await w.link();
    expect(await w.count()).toBe(0);
    await join((await person()).cookie, invite.token);
    await join((await person()).cookie, invite.token);

    expect(await w.count()).toBe(2);
    expect(await w.count(manager.cookie)).toBe(2);
    expect(await w.count(member.cookie)).toBe(0);
  });

  it('approves: the person becomes a Member and leaves the list', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const visitor = await person();
    const invite = await w.link();
    await join(visitor.cookie, invite.token);
    const [request] = await w.list();

    const res = await w.decide(manager.cookie, request!.id, 'approve');
    expect(res.status).toBe(200);
    expect((await w.roles())[visitor.id]).toBe('MEMBER');
    expect(await w.list()).toEqual([]);
    expect(await w.count()).toBe(0);
    expect(
      await read(await preview(visitor.cookie, invite.token)),
    ).toMatchObject({ isMember: true });
    expect(await read(await join(visitor.cookie, invite.token))).toEqual({
      result: 'joined',
      projectId: w.id,
    });
  });

  it('declines: no membership, and the slot is not given back', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ maxUses: 2 });
    await join(visitor.cookie, invite.token);
    const [request] = await w.list();

    const res = await w.decide(w.owner.cookie, request!.id, 'decline');
    expect(res.status).toBe(200);
    expect(await w.roles()).not.toHaveProperty(visitor.id);
    expect(await w.list()).toEqual([]);
    expect((await w.current()).useCount).toBe(1);
    expect(
      await read(await preview(visitor.cookie, invite.token)),
    ).toMatchObject({ isMember: false, request: 'DECLINED' });
  });

  it('answers 409 already_decided on a second decision, 404 on an unknown request', async () => {
    const w = await setup();
    const other = await setup();
    const visitor = await person();
    const invite = await w.link();
    await join(visitor.cookie, invite.token);
    const [request] = await w.list();
    await w.decide(w.owner.cookie, request!.id, 'decline');

    for (const what of ['approve', 'decline']) {
      const res = await w.decide(w.owner.cookie, request!.id, what);
      expect(res.status).toBe(409);
      expect(await read(res)).toMatchObject({ code: 'already_decided' });
    }
    expect(await w.roles()).not.toHaveProperty(visitor.id);
    expect(
      (await w.decide(w.owner.cookie, randomUUID(), 'approve')).status,
    ).toBe(404);
    // Another project's owner can't reach it through their own project.
    expect(
      (await other.decide(other.owner.cookie, request!.id, 'approve')).status,
    ).toBe(404);
  });

  it('gives one decision when an owner and a manager decide at once', async () => {
    const w = await setup();
    const manager = await w.add('MANAGER');
    const visitor = await person();
    const invite = await w.link();
    await join(visitor.cookie, invite.token);
    const [request] = await w.list();

    const responses = await Promise.all([
      w.decide(w.owner.cookie, request!.id, 'approve'),
      w.decide(manager.cookie, request!.id, 'decline'),
    ]);
    expect(responses.map((r) => r.status).sort((x, y) => x - y)).toEqual([
      200, 409,
    ]);
    const approved = responses[0]!.status === 200;
    expect(Boolean((await w.roles())[visitor.id])).toBe(approved);
  });

  it('lets a declined person ask again through the same link without a new slot', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ maxUses: 1 });
    await join(visitor.cookie, invite.token);
    await w.decide(w.owner.cookie, (await w.list())[0]!.id, 'decline');
    // The link is full now, but this person already has their slot.
    expect((await w.current()).state).toBe('full');

    const again = await join(visitor.cookie, invite.token);
    expect(again.status).toBe(200);
    expect(await read(again)).toEqual({ result: 'requested', projectId: w.id });
    expect((await w.current()).useCount).toBe(1);
    const rows = await w.list();
    expect(rows.map((r) => r.userId)).toEqual([visitor.id]);

    await w.decide(w.owner.cookie, rows[0]!.id, 'approve');
    expect((await w.roles())[visitor.id]).toBe('MEMBER');
  });

  it('answers 409 invite_full to a new person once the requests used every slot', async () => {
    const w = await setup();
    const [first, second] = [await person(), await person()];
    const invite = await w.link({ maxUses: 1 });
    await join(first.cookie, invite.token);

    for (const res of [
      await preview(second.cookie, invite.token),
      await join(second.cookie, invite.token),
    ]) {
      expect(res.status).toBe(409);
      expect(await read(res)).toMatchObject({ code: 'invite_full' });
    }
    expect(await w.list()).toHaveLength(1);
  });

  it('keeps requests when the link is replaced or deleted, and they can still be approved', async () => {
    const w = await setup();
    const [first, second] = [await person(), await person()];
    const invite = await w.link();
    await join(first.cookie, invite.token);
    await join(second.cookie, invite.token);

    await w.link();
    expect(await w.list()).toHaveLength(2);
    await api.send('DELETE', `/api/projects/${w.id}/invite`, w.owner.cookie);
    const rows = await w.list();
    expect(rows).toHaveLength(2);

    expect(
      (await w.decide(w.owner.cookie, rows[0]!.id, 'approve')).status,
    ).toBe(200);
    expect((await w.roles())[first.id]).toBe('MEMBER');
  });

  it('keeps requests after the link expires', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link();
    await join(visitor.cookie, invite.token);
    await prisma.invite.update({
      where: { token: invite.token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const rows = await w.list();
    expect(rows).toHaveLength(1);
    expect(
      (await w.decide(w.owner.cookie, rows[0]!.id, 'approve')).status,
    ).toBe(200);
    expect((await w.roles())[visitor.id]).toBe('MEMBER');
  });

  it('gives back the waiting request when the person opens a newer link of the project', async () => {
    const w = await setup();
    const visitor = await person();
    const old = await w.link();
    await join(visitor.cookie, old.token);
    const next = await w.link({ maxUses: 3 });

    const res = await join(visitor.cookie, next.token);
    expect(await read(res)).toEqual({ result: 'requested', projectId: w.id });
    expect(await w.list()).toHaveLength(1);
    expect((await w.current()).useCount).toBe(0);
    expect(await read(await preview(visitor.cookie, next.token))).toMatchObject(
      {
        request: 'PENDING',
      },
    );
  });

  it('clears the waiting request when the person is added by email', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link();
    await join(visitor.cookie, invite.token);

    expect((await w.addByEmail(visitor.email)).status).toBe(201);
    expect(await w.list()).toEqual([]);
    expect(await w.count()).toBe(0);
  });

  it('clears the waiting request when the person joins through a newer open link', async () => {
    const w = await setup();
    const visitor = await person();
    const approval = await w.link();
    await join(visitor.cookie, approval.token);
    const open = await w.link({ joinApproval: false });

    expect(await read(await join(visitor.cookie, open.token))).toEqual({
      result: 'joined',
      projectId: w.id,
    });
    expect((await w.roles())[visitor.id]).toBe('MEMBER');
    expect(await w.list()).toEqual([]);
  });

  it('does not use a second slot when an approved person leaves and asks again', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link({ maxUses: 1 });
    await join(visitor.cookie, invite.token);
    await w.decide(w.owner.cookie, (await w.list())[0]!.id, 'approve');
    await api.send(
      'DELETE',
      `/api/projects/${w.id}/members/${visitor.id}`,
      visitor.cookie,
    );

    const again = await join(visitor.cookie, invite.token);
    expect(await read(again)).toEqual({ result: 'requested', projectId: w.id });
    expect((await w.current()).useCount).toBe(1);
    expect(await w.list()).toHaveLength(1);
  });

  it('refuses asking again once the link is expired', async () => {
    const w = await setup();
    const visitor = await person();
    const invite = await w.link();
    await join(visitor.cookie, invite.token);
    await w.decide(w.owner.cookie, (await w.list())[0]!.id, 'decline');
    await prisma.invite.update({
      where: { token: invite.token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await join(visitor.cookie, invite.token);
    expect(res.status).toBe(410);
    expect(await read(res)).toMatchObject({ code: 'invite_expired' });
    expect(await w.list()).toEqual([]);
  });

  describe('the requester', () => {
    interface MineRow {
      id: string;
      projectName: string;
      keyPrefix: string;
      requestedAt: string;
    }
    const mine = async (cookie: string) =>
      (await read(
        await api.send('GET', '/api/join-requests', cookie),
      )) as MineRow[];
    const cancel = (cookie: string, requestId: string) =>
      api.send('DELETE', `/api/join-requests/${requestId}`, cookie);

    it('sees their waiting requests with the project name and key, and nothing else', async () => {
      const [a, b] = [await setup(), await setup()];
      const visitor = await person();
      await join(visitor.cookie, (await a.link()).token);
      await join(visitor.cookie, (await b.link()).token);

      const rows = await mine(visitor.cookie);
      expect(rows).toHaveLength(2);
      expect(Object.keys(rows[0]!).sort()).toEqual([
        'id',
        'keyPrefix',
        'projectName',
        'requestedAt',
      ]);
      expect(rows[0]).toMatchObject({ projectName: 'Approval test' });
      expect(rows[0]!.keyPrefix).toMatch(/^[A-Z]{5}$/);
      expect(rows.map((r) => r.id).sort()).toEqual(
        [(await a.list())[0]!.id, (await b.list())[0]!.id].sort(),
      );
      // Other people's requests are not theirs to see.
      expect(await mine(a.owner.cookie)).toEqual([]);
    });

    it('no longer lists a request once it is approved or declined', async () => {
      const [a, b] = [await setup(), await setup()];
      const visitor = await person();
      await join(visitor.cookie, (await a.link()).token);
      await join(visitor.cookie, (await b.link()).token);
      await a.decide(a.owner.cookie, (await a.list())[0]!.id, 'approve');
      await b.decide(b.owner.cookie, (await b.list())[0]!.id, 'decline');

      expect(await mine(visitor.cookie)).toEqual([]);
    });

    it('cancels their own request: it leaves both lists and the slot stays used', async () => {
      const w = await setup();
      const visitor = await person();
      const invite = await w.link({ maxUses: 3 });
      await join(visitor.cookie, invite.token);
      const [row] = await mine(visitor.cookie);

      const res = await cancel(visitor.cookie, row!.id);
      expect(res.status).toBe(200);
      expect(await mine(visitor.cookie)).toEqual([]);
      expect(await w.list()).toEqual([]);
      expect(await w.count()).toBe(0);
      expect((await w.current()).useCount).toBe(1);
      expect(
        await read(await preview(visitor.cookie, invite.token)),
      ).toMatchObject({ request: 'CANCELED', requestId: null });
    });

    it("answers 404 for someone else's request or an unknown id, 409 once it is decided", async () => {
      const w = await setup();
      const [visitor, other] = [await person(), await person()];
      const invite = await w.link();
      await join(visitor.cookie, invite.token);
      const [row] = await mine(visitor.cookie);

      const hidden = await Promise.all([
        cancel(other.cookie, row!.id),
        // An owner declines; they don't cancel for the person.
        cancel(w.owner.cookie, row!.id),
        cancel(visitor.cookie, randomUUID()),
        cancel(visitor.cookie, 'not-a-uuid'),
      ]);
      expect(hidden.map((r) => r.status)).toEqual([404, 404, 404, 404]);
      expect(await w.list()).toHaveLength(1);

      await w.decide(w.owner.cookie, row!.id, 'decline');
      const late = await cancel(visitor.cookie, row!.id);
      expect(late.status).toBe(409);
      expect(await read(late)).toMatchObject({ code: 'already_decided' });
    });

    it('has one winner when a cancel and an approval race', async () => {
      const w = await setup();
      const visitor = await person();
      const invite = await w.link();
      await join(visitor.cookie, invite.token);
      const [row] = await mine(visitor.cookie);

      const [canceled, approved] = await Promise.all([
        cancel(visitor.cookie, row!.id),
        w.decide(w.owner.cookie, row!.id, 'approve'),
      ]);
      expect([canceled.status, approved.status].sort((x, y) => x - y)).toEqual([
        200, 409,
      ]);
      expect(Boolean((await w.roles())[visitor.id])).toBe(
        approved.status === 200,
      );
    });

    it('asks again after cancelling, through the same link, without a new slot', async () => {
      const w = await setup();
      const visitor = await person();
      const invite = await w.link({ maxUses: 1 });
      await join(visitor.cookie, invite.token);
      await cancel(visitor.cookie, (await mine(visitor.cookie))[0]!.id);

      const again = await join(visitor.cookie, invite.token);
      expect(await read(again)).toEqual({
        result: 'requested',
        projectId: w.id,
      });
      expect((await w.current()).useCount).toBe(1);
      expect(await mine(visitor.cookie)).toHaveLength(1);
      expect(await w.list()).toHaveLength(1);
    });

    it('previews the state of their request: waiting with its id, then declined', async () => {
      const w = await setup();
      const visitor = await person();
      const invite = await w.link({ maxUses: 1 });
      await join(visitor.cookie, invite.token);
      const [row] = await mine(visitor.cookie);

      expect(
        await read(await preview(visitor.cookie, invite.token)),
      ).toMatchObject({ request: 'PENDING', requestId: row!.id });
      await w.decide(w.owner.cookie, row!.id, 'decline');
      // Full for everyone else, but they hold a slot, so they may ask again.
      const declined = await preview(visitor.cookie, invite.token);
      expect(declined.status).toBe(200);
      expect(await read(declined)).toMatchObject({
        request: 'DECLINED',
        requestId: null,
        isMember: false,
      });
    });

    it('still previews a waiting request after its link is replaced, deleted or expired', async () => {
      const w = await setup();
      const visitor = await person();
      const invite = await w.link();
      await join(visitor.cookie, invite.token);
      const [row] = await mine(visitor.cookie);
      const waiting = {
        projectName: 'Approval test',
        request: 'PENDING',
        requestId: row!.id,
      };

      await prisma.invite.update({
        where: { token: invite.token },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(
        await read(await preview(visitor.cookie, invite.token)),
      ).toMatchObject(waiting);
      await w.link();
      expect(
        await read(await preview(visitor.cookie, invite.token)),
      ).toMatchObject(waiting);

      // Once they cancel, the dead link tells them nothing any more.
      await cancel(visitor.cookie, row!.id);
      const gone = await preview(visitor.cookie, invite.token);
      expect(gone.status).toBe(404);
      expect(await read(gone)).toMatchObject({ code: 'invite_not_found' });
    });
  });
});
