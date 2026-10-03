import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import {
  LOGOUT_EVENT,
  USER_DELETED_EVENT,
  USER_UPDATED_EVENT,
} from '@/modules/uniauth/event-token.js';
import { startMockUniauth, type MockProfile } from './support/mock-uniauth.js';
import { loadApp, WEB_ORIGIN } from './support/test-app.js';

const CLIENT = { id: 'uniloom-test', secret: 'uniloom-test-secret' };
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_DOMAIN = `e2e-${randomUUID()}.example`;

describe('Uniloom API (e2e)', () => {
  let app: Awaited<ReturnType<typeof loadApp>>;
  let uniauth: Awaited<ReturnType<typeof startMockUniauth>>;

  beforeAll(async () => {
    uniauth = await startMockUniauth(CLIENT);
    app = await loadApp(uniauth.issuer, CLIENT);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${EMAIL_DOMAIN}` } },
    });
    await prisma.$disconnect();
    await uniauth?.close();
  });

  function newProfile(overrides: Partial<MockProfile> = {}): MockProfile {
    return {
      sub: `u_${randomUUID()}`,
      email: `${randomUUID()}@${EMAIL_DOMAIN}`,
      name: 'Mya',
      ...overrides,
    };
  }

  /** A request to the API, as the web proxy would send it. */
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const { cookie, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (cookie) headers.set('cookie', cookie);
    return app.request(path, { ...rest, headers });
  };

  /** Runs the whole OIDC sign-in against the mock uniAuth and returns the session cookie. */
  async function signIn(profile: MockProfile) {
    uniauth.signInAs(profile);
    const start = await call('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'uniauth',
        callbackURL: `${WEB_ORIGIN}/`,
      }),
    });
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const authorize = await fetch(url, { redirect: 'manual' });
    const callback = new URL(authorize.headers.get('location') ?? '');
    expect(`${callback.origin}${callback.pathname}`).toBe(
      `${WEB_ORIGIN}/api/auth/callback/uniauth`,
    );

    const done = await call(`${callback.pathname}${callback.search}`, {
      cookie: start.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    });
    expect(done.status).toBe(302);
    expect(done.headers.get('location')).toBe(`${WEB_ORIGIN}/`);

    const setCookie = done.headers
      .getSetCookie()
      .find((c) => c.startsWith('uniloom.session_token='));
    expect(setCookie).toBeDefined();
    return { setCookie: setCookie!, cookie: setCookie!.split(';')[0] };
  }

  const sessionFor = (email: string) =>
    prisma.session.findFirstOrThrow({ where: { user: { email } } });

  describe('public routes', () => {
    it('reaches PostgreSQL through Prisma', async () => {
      const [row] = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
      expect(row.ok).toBe(1);
    });

    it.each(['/health', '/api/health'])(
      'serves %s without a session',
      async (path) => {
        const res = await call(path);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
      },
    );
  });

  describe('Better Auth config', () => {
    it('has no email and password sign-up', async () => {
      const email = `signup-${randomUUID()}@example.com`;
      const res = await call('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'password1234', name: 'X' }),
      });

      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe(
        'EMAIL_PASSWORD_SIGN_UP_DISABLED',
      );
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('links the person by uniAuth sub and sets a host-only uniloom cookie', async () => {
      const profile = newProfile();
      const { setCookie } = await signIn(profile);

      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).not.toMatch(/Domain=/i);
      const account = await prisma.account.findFirstOrThrow({
        where: { user: { email: profile.email } },
      });
      expect(account).toMatchObject({
        providerId: 'uniauth',
        accountId: profile.sub,
      });
    });

    it('creates a session that lasts 7 days', async () => {
      const profile = newProfile();
      await signIn(profile);

      const session = await sessionFor(profile.email);
      const lifetime =
        session.expiresAt.getTime() - session.createdAt.getTime();
      expect(Math.abs(lifetime - 7 * DAY_MS)).toBeLessThan(60_000);
    });
  });

  describe('session check', () => {
    it('rejects a request without a cookie', async () => {
      expect((await call('/api/me')).status).toBe(401);
    });

    it('rejects a random token', async () => {
      const res = await call('/api/me', {
        cookie: `uniloom.session_token=${randomUUID()}`,
      });
      expect(res.status).toBe(401);
    });

    it('rejects a deleted session', async () => {
      const profile = newProfile();
      const { cookie } = await signIn(profile);
      await prisma.session.deleteMany({
        where: { user: { email: profile.email } },
      });

      expect((await call('/api/me', { cookie })).status).toBe(401);
    });

    it('rejects an expired session', async () => {
      const profile = newProfile();
      const { cookie } = await signIn(profile);
      await prisma.session.updateMany({
        where: { user: { email: profile.email } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      expect((await call('/api/me', { cookie })).status).toBe(401);
    });

    it('slides a session last moved 2 days ago to 7 days from now, keeping the token', async () => {
      const profile = newProfile();
      const { cookie } = await signIn(profile);
      const before = await sessionFor(profile.email);
      await prisma.session.update({
        where: { id: before.id },
        data: { expiresAt: new Date(Date.now() + 5 * DAY_MS) },
      });

      const res = await call('/api/me', { cookie });
      expect(res.status).toBe(200);

      const after = await sessionFor(profile.email);
      expect(after.token).toBe(before.token);
      expect(
        Math.abs(after.expiresAt.getTime() - (Date.now() + 7 * DAY_MS)),
      ).toBeLessThan(60_000);
      // The browser gets the moved expiry too.
      expect(
        res.headers
          .getSetCookie()
          .some((c) => c.startsWith('uniloom.session_token=')),
      ).toBe(true);
    });

    it('leaves a session moved less than a day ago alone', async () => {
      const profile = newProfile();
      const { cookie } = await signIn(profile);
      const before = await sessionFor(profile.email);

      expect((await call('/api/me', { cookie })).status).toBe(200);

      const after = await sessionFor(profile.email);
      expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
    });
  });

  describe('GET /api/me', () => {
    it('returns the signed-in user', async () => {
      const profile = newProfile({
        picture: 'https://auth.psstee.dev/api/avatars/a.png',
      });
      const { cookie } = await signIn(profile);

      const res = await call('/api/me', { cookie });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        id: expect.any(String),
        email: profile.email,
        emailVerified: true,
        name: 'Mya',
        image: profile.picture,
        consentGivenAt: null,
      });
    });

    it('returns image null for a user without an avatar', async () => {
      const { cookie } = await signIn(newProfile());

      const res = await call('/api/me', { cookie });

      expect(((await res.json()) as { image: unknown }).image).toBeNull();
    });
  });

  describe('uniAuth receivers', () => {
    const post = (path: string, form: Record<string, string>) =>
      call(`/api/uniauth/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form).toString(),
      });
    const RECEIVERS = [
      {
        path: 'backchannel-logout',
        field: 'logout_token',
        event: LOGOUT_EVENT,
      },
      { path: 'user-deleted', field: 'token', event: USER_DELETED_EVENT },
      { path: 'user-updated', field: 'token', event: USER_UPDATED_EVENT },
    ];

    it.each(RECEIVERS)('$path: missing token → 400', async ({ path }) => {
      expect((await post(path, {})).status).toBe(400);
    });

    it.each(RECEIVERS)(
      '$path: invalid token → 400',
      async ({ path, field }) => {
        expect((await post(path, { [field]: 'not-a-jwt' })).status).toBe(400);
      },
    );

    it.each(RECEIVERS)(
      '$path: unknown sub → 200 and no change',
      async ({ path, field, event }) => {
        const profile = newProfile();
        await signIn(profile);
        const before = await prisma.user.findUniqueOrThrow({
          where: { email: profile.email },
          include: { sessions: true },
        });

        const token = await uniauth.signEvent(`u_${randomUUID()}`, {
          [event]: { name: 'Changed' },
        });
        expect((await post(path, { [field]: token })).status).toBe(200);

        expect(
          await prisma.user.findUniqueOrThrow({
            where: { email: profile.email },
            include: { sessions: true },
          }),
        ).toEqual(before);
      },
    );

    it('backchannel-logout ends every session of the user', async () => {
      const profile = newProfile();
      const first = await signIn(profile);
      const second = await signIn(profile);

      const token = await uniauth.signEvent(profile.sub, {
        [LOGOUT_EVENT]: {},
      });
      expect(
        (await post('backchannel-logout', { logout_token: token })).status,
      ).toBe(200);

      expect(
        await prisma.session.count({
          where: { user: { email: profile.email } },
        }),
      ).toBe(0);
      for (const { cookie } of [first, second]) {
        expect((await call('/api/me', { cookie })).status).toBe(401);
      }
    });

    it('user-deleted rejects a logout token and keeps the user', async () => {
      const profile = newProfile();
      await signIn(profile);

      const token = await uniauth.signEvent(profile.sub, {
        [LOGOUT_EVENT]: {},
      });
      expect((await post('user-deleted', { token })).status).toBe(400);

      expect(await prisma.user.count({ where: { email: profile.email } })).toBe(
        1,
      );
    });

    it('user-deleted removes the user, accounts, sessions and memberships', async () => {
      const profile = newProfile();
      await signIn(profile);
      const { id } = await prisma.user.findUniqueOrThrow({
        where: { email: profile.email },
      });
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Deletion test',
          keyPrefix: `D${randomUUID().slice(0, 8)}`,
          mode: 'STANDARD',
          checklistRequired: false,
          designRequired: false,
          approvalRequired: false,
          approverNotAuthor: false,
          plannedVsActual: false,
          members: { create: { userId: id, role: 'OWNER' } },
        },
      });

      const token = await uniauth.signEvent(profile.sub, {
        [USER_DELETED_EVENT]: {},
      });
      expect((await post('user-deleted', { token })).status).toBe(200);

      expect(await prisma.user.count({ where: { id } })).toBe(0);
      expect(await prisma.account.count({ where: { userId: id } })).toBe(0);
      expect(await prisma.session.count({ where: { userId: id } })).toBe(0);
      expect(await prisma.member.count({ where: { userId: id } })).toBe(0);
      await prisma.workspace.delete({ where: { id: workspace.id } });
    });

    it('user-updated refreshes the copy', async () => {
      const profile = newProfile({
        picture: 'https://auth.psstee.dev/api/avatars/a.png',
      });
      await signIn(profile);
      const newEmail = `${randomUUID()}@${EMAIL_DOMAIN}`;

      const token = await uniauth.signEvent(profile.sub, {
        [USER_UPDATED_EVENT]: {
          email: newEmail.toUpperCase(),
          email_verified: false,
          name: 'Mya Mya',
          picture: null,
        },
      });
      expect((await post('user-updated', { token })).status).toBe(200);

      expect(
        await prisma.user.findUniqueOrThrow({ where: { email: newEmail } }),
      ).toMatchObject({ name: 'Mya Mya', emailVerified: false, image: null });
    });

    it('user-updated keeps the name when the new one is empty', async () => {
      const profile = newProfile();
      await signIn(profile);

      const token = await uniauth.signEvent(profile.sub, {
        [USER_UPDATED_EVENT]: { name: '' },
      });
      expect((await post('user-updated', { token })).status).toBe(200);

      expect(
        await prisma.user.findUniqueOrThrow({
          where: { email: profile.email },
        }),
      ).toMatchObject({ name: 'Mya' });
    });
  });

  describe('consent', () => {
    const consent = (cookie?: string) =>
      call('/api/users/me/consent', { method: 'POST', cookie });
    // No feature routes yet: an unknown route still goes through both checks, and answers
    // 404 only once they pass.
    const protectedRoute = (cookie?: string) => call('/api/probe', { cookie });

    it('POST /api/users/me/consent without a session → 401', async () => {
      expect((await consent()).status).toBe(401);
    });

    it('records consent once and keeps the first timestamp', async () => {
      const { cookie } = await signIn(newProfile());

      const first = await consent(cookie);
      expect(first.status).toBe(200);
      const { consentGivenAt } = (await first.json()) as {
        consentGivenAt: string;
      };
      expect(Date.parse(consentGivenAt)).toBeGreaterThan(Date.now() - 60_000);
      const second = (await (await consent(cookie)).json()) as {
        consentGivenAt: string;
      };
      expect(second.consentGivenAt).toBe(consentGivenAt);
    });

    it('a protected route without a session → 401', async () => {
      expect((await protectedRoute()).status).toBe(401);
    });

    it('a new user gets 403 consent_required, then passes after consent', async () => {
      const { cookie } = await signIn(newProfile());

      const blocked = await protectedRoute(cookie);
      expect(blocked.status).toBe(403);
      expect(((await blocked.json()) as { code: string }).code).toBe(
        'consent_required',
      );

      expect((await consent(cookie)).status).toBe(200);
      expect((await protectedRoute(cookie)).status).toBe(404);
    });

    it('GET /api/me works without consent and shows consentGivenAt', async () => {
      const { cookie } = await signIn(newProfile());

      const before = (await (await call('/api/me', { cookie })).json()) as {
        consentGivenAt: unknown;
      };
      expect(before.consentGivenAt).toBeNull();

      const given = (await (await consent(cookie)).json()) as {
        consentGivenAt: string;
      };
      const after = (await (await call('/api/me', { cookie })).json()) as {
        consentGivenAt: string;
      };
      expect(after.consentGivenAt).toBe(given.consentGivenAt);
    });

    it('health, auth and uniAuth receivers work for a user without consent', async () => {
      const { cookie } = await signIn(newProfile());

      expect((await call('/health', { cookie })).status).toBe(200);
      expect((await call('/api/health', { cookie })).status).toBe(200);
      const session = await call('/api/auth/get-session', { cookie });
      expect(session.status).toBe(200);
      expect(
        ((await session.json()) as { user: { consentGivenAt: unknown } }).user
          .consentGivenAt,
      ).toBeNull();
      // Reaches the receiver: a bad token is its own 400, not the consent 403.
      const receiver = await call('/api/uniauth/user-updated', {
        method: 'POST',
        cookie,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'token=not-a-jwt',
      });
      expect(receiver.status).toBe(400);
    });
  });
});
