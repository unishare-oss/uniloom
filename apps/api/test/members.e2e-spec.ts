import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

interface MemberRow {
  userId: string;
  email: string;
  role: string;
}

describe('members and roles (e2e)', () => {
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

  /** A project owned by a new person, with helpers for the members routes. */
  const setup = async () => {
    const owner = await person();
    const res = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'W',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id } = (await read(res)) as { id: string };
    const path = `/api/projects/${id}/members`;
    const add = (cookie: string, email: string, role: string) =>
      api.send('POST', path, cookie, { email, role });
    /** Adds a new person with `role`, through the API as the owner. */
    const join = async (role: string) => {
      const p = await person();
      expect((await add(owner.cookie, p.email, role)).status).toBe(201);
      return p;
    };
    const list = async (cookie: string) =>
      (await read(await api.send('GET', path, cookie))) as MemberRow[];
    return { owner, id, path, add, join, list };
  };

  it('lists members with name, email, image and role, owners first', async () => {
    const w = await setup();
    const reviewer = await w.join('REVIEWER');
    const member = await w.join('MEMBER');
    const rows = await w.list(member.cookie);
    expect(rows.map((r) => r.email)).toEqual([
      w.owner.email,
      reviewer.email,
      member.email,
    ]);
    expect(rows[0]).toMatchObject({ role: 'OWNER', image: null });
    expect(rows[0]).toHaveProperty('name');
  });

  it('returns the caller role and canManageMembers on the project', async () => {
    const w = await setup();
    const reviewer = await w.join('REVIEWER');
    const get = async (cookie: string) =>
      read(await api.send('GET', `/api/projects/${w.id}`, cookie));
    expect(await get(w.owner.cookie)).toMatchObject({
      role: 'OWNER',
      canManageMembers: true,
    });
    expect(await get(reviewer.cookie)).toMatchObject({
      role: 'REVIEWER',
      canManageMembers: false,
    });
  });

  it('answers 404 on every members route to someone outside the project', async () => {
    const w = await setup();
    const stranger = await person();
    const target = `${w.path}/${w.owner.id}`;
    const responses = await Promise.all([
      api.send('GET', w.path, stranger.cookie),
      w.add(stranger.cookie, w.owner.email, 'MEMBER'),
      api.send('PATCH', target, stranger.cookie, { role: 'MEMBER' }),
      api.send('DELETE', target, stranger.cookie),
      api.send('GET', `/api/projects/${randomUUID()}/members`, w.owner.cookie),
    ]);
    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
    expect((await w.list(w.owner.cookie)).map((r) => r.userId)).toEqual([
      w.owner.id,
    ]);
  });

  it('lets an owner add by email; reviewers and members get 403', async () => {
    const w = await setup();
    const reviewer = await w.join('REVIEWER');
    const member = await w.join('MEMBER');
    const newcomer = await person();

    for (const who of [reviewer, member]) {
      const res = await w.add(who.cookie, newcomer.email, 'MEMBER');
      expect(res.status).toBe(403);
      expect(await read(res)).toMatchObject({ code: 'forbidden' });
    }
    const res = await w.add(w.owner.cookie, newcomer.email, 'REVIEWER');
    expect(res.status).toBe(201);
    expect(await read(res)).toMatchObject({
      email: newcomer.email,
      role: 'REVIEWER',
    });
  });

  it('answers 404 user_not_found, 409 already_member and 400 for bad input on add', async () => {
    const w = await setup();
    const gone = await w.add(
      w.owner.cookie,
      `nobody-${randomUUID()}@${api.emailDomain}`,
      'MEMBER',
    );
    expect(gone.status).toBe(404);
    expect(await read(gone)).toMatchObject({ code: 'user_not_found' });

    const again = await w.add(w.owner.cookie, w.owner.email, 'MEMBER');
    expect(again.status).toBe(409);
    expect(await read(again)).toMatchObject({ code: 'already_member' });

    expect((await w.add(w.owner.cookie, 'nope', 'MEMBER')).status).toBe(400);
    expect((await w.add(w.owner.cookie, w.owner.email, 'KING')).status).toBe(
      400,
    );
  });

  it('lets an owner change roles and make other owners; others get 403', async () => {
    const w = await setup();
    const member = await w.join('MEMBER');
    const other = await w.join('MEMBER');
    const patch = (cookie: string, id: string, role: string) =>
      api.send('PATCH', `${w.path}/${id}`, cookie, { role });

    const denied = await patch(member.cookie, other.id, 'OWNER');
    expect(denied.status).toBe(403);
    expect(await read(denied)).toMatchObject({ code: 'forbidden' });

    const promoted = await patch(w.owner.cookie, member.id, 'OWNER');
    expect(promoted.status).toBe(200);
    expect(await read(promoted)).toMatchObject({ role: 'OWNER' });
    // The new owner can manage others now.
    expect((await patch(member.cookie, other.id, 'REVIEWER')).status).toBe(200);
    expect((await patch(w.owner.cookie, randomUUID(), 'MEMBER')).status).toBe(
      404,
    );
  });

  it('refuses to demote or remove the last owner, but allows it with a second owner', async () => {
    const w = await setup();
    const member = await w.join('MEMBER');
    const demote = await api.send(
      'PATCH',
      `${w.path}/${w.owner.id}`,
      w.owner.cookie,
      { role: 'MEMBER' },
    );
    expect(demote.status).toBe(409);
    expect(await read(demote)).toMatchObject({ code: 'last_owner' });

    const remove = await api.send(
      'DELETE',
      `${w.path}/${w.owner.id}`,
      w.owner.cookie,
    );
    expect(remove.status).toBe(409);
    expect(await read(remove)).toMatchObject({ code: 'last_owner' });

    await api.send('PATCH', `${w.path}/${member.id}`, w.owner.cookie, {
      role: 'OWNER',
    });
    expect(
      (
        await api.send('PATCH', `${w.path}/${w.owner.id}`, w.owner.cookie, {
          role: 'MEMBER',
        })
      ).status,
    ).toBe(200);
  });

  it('keeps one owner when two owners demote each other at once', async () => {
    const w = await setup();
    const second = await w.join('OWNER');
    const results = await Promise.all([
      api.send('PATCH', `${w.path}/${second.id}`, w.owner.cookie, {
        role: 'MEMBER',
      }),
      api.send('PATCH', `${w.path}/${w.owner.id}`, second.cookie, {
        role: 'MEMBER',
      }),
    ]);
    // The loser gets 409 last_owner, or 403 if the winner demoted them before the check.
    const [winner, loser] = results.map((r) => r.status).sort((x, y) => x - y);
    expect(winner).toBe(200);
    expect([403, 409]).toContain(loser);
    const rows = await prisma.member.findMany({
      where: { projectId: w.id, role: 'OWNER' },
    });
    expect(rows).toHaveLength(1);
  });

  it('lets an owner remove a member; others cannot remove someone else', async () => {
    const w = await setup();
    const reviewer = await w.join('REVIEWER');
    const member = await w.join('MEMBER');

    const denied = await api.send(
      'DELETE',
      `${w.path}/${member.id}`,
      reviewer.cookie,
    );
    expect(denied.status).toBe(403);
    expect(await read(denied)).toMatchObject({ code: 'forbidden' });

    const removed = await api.send(
      'DELETE',
      `${w.path}/${member.id}`,
      w.owner.cookie,
    );
    expect(removed.status).toBe(200);
    expect(await read(removed)).toBeNull();
    expect((await w.list(w.owner.cookie)).map((r) => r.userId)).not.toContain(
      member.id,
    );
    // The removed person is now an outsider.
    expect((await api.send('GET', w.path, member.cookie)).status).toBe(404);
    expect(
      (await api.send('DELETE', `${w.path}/${member.id}`, w.owner.cookie))
        .status,
    ).toBe(404);
  });

  it('lets any member leave, but not the last owner', async () => {
    const w = await setup();
    const reviewer = await w.join('REVIEWER');
    const left = await api.send(
      'DELETE',
      `${w.path}/${reviewer.id}`,
      reviewer.cookie,
    );
    expect(left.status).toBe(200);
    expect((await api.send('GET', w.path, reviewer.cookie)).status).toBe(404);

    const stuck = await api.send(
      'DELETE',
      `${w.path}/${w.owner.id}`,
      w.owner.cookie,
    );
    expect(stuck.status).toBe(409);
    expect(await read(stuck)).toMatchObject({ code: 'last_owner' });
  });

  it('makes a sole owner hand over ownership before leaving', async () => {
    const w = await setup();
    const member = await w.join('MEMBER');
    const leave = () =>
      api.send('DELETE', `${w.path}/${w.owner.id}`, w.owner.cookie);

    const stuck = await leave();
    expect(stuck.status).toBe(409);
    expect(await read(stuck)).toMatchObject({
      code: 'last_owner',
      message: expect.stringContaining('Make another member an owner'),
    });

    await api.send('PATCH', `${w.path}/${member.id}`, w.owner.cookie, {
      role: 'OWNER',
    });
    expect((await leave()).status).toBe(200);
    expect((await api.send('GET', w.path, member.cookie)).status).toBe(200);
  });
});
