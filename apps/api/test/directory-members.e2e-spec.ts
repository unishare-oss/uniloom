import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

describe('add by email through the uniAuth directory (e2e)', () => {
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

  /** An owner with a project, and a way to add people to it by email. */
  const setup = async () => {
    const { cookie } = await api.signInReady();
    const res = await api.send('POST', '/api/projects', cookie, {
      name: 'W',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id } = (await read(res)) as { id: string };
    const add = (email: string) =>
      api.send('POST', `/api/projects/${id}/members`, cookie, {
        email,
        role: 'MEMBER',
      });
    return { cookie, id, add };
  };

  const links = (sub: string) =>
    prisma.account.findMany({
      where: { providerId: 'uniauth', accountId: sub },
    });

  it('adds a person who only exists in uniAuth; their first sign-in lands on the same user', async () => {
    const w = await setup();
    const alice = api.newProfile({ name: 'Alice' });
    api.uniauth.registerAccount(alice);
    expect(
      await prisma.user.findUnique({ where: { email: alice.email } }),
    ).toBe(null);

    const added = await w.add(alice.email);
    expect(added.status).toBe(201);
    const member = (await read(added)) as { userId: string; email: string };
    expect(member.email).toBe(alice.email);

    // The local user exists with the uniAuth link and nothing else: no credential, no terms.
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: alice.email },
      include: { accounts: true },
    });
    expect(user.id).toBe(member.userId);
    expect(user).toMatchObject({
      name: 'Alice',
      emailVerified: true,
      consentGivenAt: null,
    });
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({
      providerId: 'uniauth',
      accountId: alice.sub,
      password: null,
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

    // She signs in later: same local user, the membership is there, shared acceptance is already available.
    const session = await api.signIn(alice);
    const me = (await read(
      await api.send('GET', '/api/me', session.cookie),
    )) as {
      id: string;
      consentGivenAt: string | null;
    };
    expect(me.id).toBe(user.id);
    expect(me.consentGivenAt).toBeNull();
    expect(
      (me as unknown as { unicorpTermsVersion: number }).unicorpTermsVersion,
    ).toBe(1);
    expect(
      (await api.send('GET', `/api/projects/${w.id}`, session.cookie)).status,
    ).toBe(200); // shared acceptance arrives with the first sign-in
    expect(
      (await api.send('POST', '/api/users/me/consent', session.cookie)).status,
    ).toBe(200);
    expect(
      (await api.send('GET', `/api/projects/${w.id}`, session.cookie)).status,
    ).toBe(200);
    expect(await prisma.user.count({ where: { email: alice.email } })).toBe(1);
    expect(await links(alice.sub)).toHaveLength(1);
    expect((await w.add(alice.email)).status).toBe(409); // already_member
  });

  it('answers the same 404 for unknown, unverified and suspended accounts, and provisions none of them', async () => {
    const w = await setup();
    const unverified = api.newProfile();
    api.uniauth.registerAccount(unverified, { verified: false });
    const suspended = api.newProfile();
    api.uniauth.registerAccount(suspended, { status: 'suspended' });

    const answers = [];
    for (const email of [
      unverified.email,
      suspended.email,
      `nobody-${randomUUID()}@${api.emailDomain}`,
    ]) {
      const res = await w.add(email);
      answers.push([res.status, await read(res)]);
    }
    expect(answers[0]).toEqual([
      404,
      expect.objectContaining({ code: 'user_not_found' }),
    ]);
    // Identical bodies: nothing distinguishes the three.
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    expect(
      await prisma.user.count({ where: { email: unverified.email } }),
    ).toBe(0);
    expect(await links(suspended.sub)).toHaveLength(0);
  });

  it('limits each person to 20 lookups an hour', async () => {
    const w = await setup();
    for (let i = 0; i < 20; i++)
      expect(
        (await w.add(`nobody-${randomUUID()}@${api.emailDomain}`)).status,
      ).toBe(404);
    const limited = await w.add(`nobody-${randomUUID()}@${api.emailDomain}`);
    expect([limited.status, (await read(limited)).code]).toEqual([
      429,
      'rate_limited',
    ]);
    // Someone else is unaffected.
    const other = await setup();
    expect(
      (await other.add(`nobody-${randomUUID()}@${api.emailDomain}`)).status,
    ).toBe(404);
  });

  it("refreshes a linked person's name from the directory when they are added", async () => {
    const w = await setup();
    const erin = api.newProfile({ name: 'Erin' });
    await api.signIn(erin);
    api.uniauth.registerAccount({ ...erin, name: 'Erin Renamed' });
    expect((await w.add(erin.email)).status).toBe(201);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: erin.email } }))
        .name,
    ).toBe('Erin Renamed');
  });

  it('answers 503, never 404, for someone unlinked when uniAuth cannot answer; linked people can still be added', async () => {
    const w = await setup();
    const bob = api.newProfile();
    api.uniauth.registerAccount(bob);
    const linked = api.newProfile({ name: 'Linked' });
    await api.signIn(linked); // has signed in here: a uniAuth link exists locally
    api.uniauth.directory.failWith = 500;
    try {
      const down = await w.add(bob.email);
      expect([down.status, (await read(down)).code]).toEqual([
        503,
        'identity_service_unavailable',
      ]);
      expect(await prisma.user.count({ where: { email: bob.email } })).toBe(0);
      // Already linked: the local copy is enough while uniAuth is down.
      expect((await w.add(linked.email)).status).toBe(201);
    } finally {
      api.uniauth.directory.failWith = 0;
    }
    expect((await w.add(bob.email)).status).toBe(201);
  });

  it('does not attach a uniAuth account to a different local user with the same email', async () => {
    const w = await setup();
    const carol = api.newProfile();
    // A local user with that email but another uniAuth link (a reconciliation case).
    const other = await prisma.user.create({
      data: { id: randomUUID(), name: 'Other', email: carol.email },
    });
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: `u_${randomUUID()}`,
        providerId: 'uniauth',
        userId: other.id,
      },
    });
    api.uniauth.registerAccount(carol);
    const res = await w.add(carol.email);
    expect([res.status, (await read(res)).code]).toEqual([
      409,
      'identity_conflict',
    ]);
    expect(await links(carol.sub)).toHaveLength(0);
  });

  it('reports a genuine email conflict without linking another identity', async () => {
    const w = await setup();
    const fay = api.newProfile();
    const other = await prisma.user.create({
      data: { id: randomUUID(), name: 'Other', email: fay.email },
    });
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: `u_${randomUUID()}`,
        providerId: 'uniauth',
        userId: other.id,
      },
    });
    api.uniauth.registerAccount(fay);
    const res = await w.add(fay.email);
    expect(res.status).toBe(409);
    expect(await links(fay.sub)).toHaveLength(0);
    expect(await prisma.user.count({ where: { email: fay.email } })).toBe(1);
  });

  it('converges on one local user when provisioning races the first sign-in and itself', async () => {
    // After startTestApi: importing it earlier would read the auth settings before the mock is up.
    const { ensureLocalUser } =
      await import('@/modules/uniauth/uniauth.service.js');
    for (let round = 0; round < 6; round++) {
      const w = await setup();
      const dana = api.newProfile({ name: `Dana ${round}` });
      api.uniauth.registerAccount(dana);

      // Several adds and the person's own first sign-in at the same moment.
      const results = await Promise.allSettled([
        w.add(dana.email),
        ensureLocalUser({
          id: dana.sub,
          name: dana.name,
          email: dana.email,
          emailVerified: true,
          image: null,
          status: 'active',
        }),
        ensureLocalUser({
          id: dana.sub,
          name: dana.name,
          email: dana.email,
          emailVerified: true,
          image: null,
          status: 'active',
        }),
        api.signIn(dana),
      ]);
      // Strict: the sign-in callback never errors, whichever writer got there first.
      expect(results.map((r) => r.status)).toEqual([
        'fulfilled',
        'fulfilled',
        'fulfilled',
        'fulfilled',
      ]);

      expect(await prisma.user.count({ where: { email: dana.email } })).toBe(1);
      expect(await links(dana.sub)).toHaveLength(1);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: dana.email },
      });
      expect((await links(dana.sub))[0]!.userId).toBe(user.id);
      // However it interleaved, one more add finds her as a member of the same user.
      const again = await w.add(dana.email);
      expect([201, 409]).toContain(again.status);
      expect((await w.add(dana.email)).status).toBe(409);
      expect(
        await prisma.member.count({
          where: { projectId: w.id, userId: user.id },
        }),
      ).toBe(1);
      const sessions = await api.signIn(dana);
      expect(
        (
          (await read(await api.send('GET', '/api/me', sessions.cookie))) as {
            id: string;
          }
        ).id,
      ).toBe(user.id);
    }
  }, 120_000);
});
