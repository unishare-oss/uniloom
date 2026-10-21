import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import {
  LOGOUT_EVENT,
  USER_DELETED_EVENT,
  USER_UPDATED_EVENT,
} from '@/modules/uniauth/event-token.js';
import { startTestApi, WEB_ORIGIN, read } from './support/test-app.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Uniloom API (e2e)', () => {
  let api: Awaited<ReturnType<typeof startTestApi>>;
  let uniauth: typeof api.uniauth;
  let call: typeof api.call;
  let signIn: typeof api.signIn;
  let newProfile: typeof api.newProfile;

  beforeAll(async () => {
    api = await startTestApi();
    ({ uniauth, call, signIn, newProfile } = api);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${api.emailDomain}` } },
    });
    await prisma.$disconnect();
    await api?.close();
  });

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

  describe('OpenAPI', () => {
    it('serves the spec with every web route and nothing else', async () => {
      const res = await call('/api/openapi.json');
      expect(res.status).toBe(200);
      const spec = (await res.json()) as {
        openapi: string;
        paths: Record<string, Record<string, { operationId: string }>>;
      };
      expect(spec.openapi).toBe('3.1.0');
      const operations = Object.values(spec.paths)
        .flatMap((ops) => Object.values(ops).map((op) => op.operationId))
        .sort();
      expect(operations).toEqual([
        'acceptTerms',
        'addBlocker',
        'addChecklistEntry',
        'addMember',
        'approveJoinRequest',
        'cancelJoinRequest',
        'changeMemberRole',
        'createDocument',
        'createDocumentComment',
        'createInvite',
        'createItem',
        'createItemComment',
        'createLabel',
        'createProject',
        'createTicketDocument',
        'declineJoinRequest',
        'deleteChecklistEntry',
        'deleteComment',
        'deleteInvite',
        'deleteItem',
        'deleteLabel',
        'deleteProject',
        'getDocument',
        'getInvite',
        'getItem',
        'getItemNotifications',
        'getMe',
        'getNotifications',
        'getProject',
        'getReviews',
        'joinByInvite',
        'linkDocument',
        'listDeletedItems',
        'listDocumentComments',
        'listDocuments',
        'listItemActivity',
        'listItemComments',
        'listItems',
        'listJoinRequests',
        'listLabels',
        'listMembers',
        'listMyJoinRequests',
        'listProjects',
        'moveItem',
        'postReadNotifications',
        'postUnreadNotifications',
        'previewInvite',
        'removeBlocker',
        'removeMember',
        'reorderChecklist',
        'restoreItem',
        'setDocumentStatus',
        'unlinkDocument',
        'updateChecklistEntry',
        'updateComment',
        'updateDocument',
        'updateItem',
        'updateLabel',
        'updateProject',
      ]);
      expect(
        Object.keys(spec.paths).some((p) => /auth|uniauth|health/.test(p)),
      ).toBe(false);
    });

    it('serves the docs page without a session', async () => {
      const res = await call('/api/docs');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
    });
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
      expect(((await read(res)) as { code: string }).code).toBe(
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
      expect(await read(res)).toEqual({
        id: expect.any(String),
        email: profile.email,
        emailVerified: true,
        name: 'Mya',
        image: profile.picture,
        consentGivenAt: null,
        unicorpTermsVersion: 1,
        unicorpTermsAcceptedAt: '2026-10-21T00:00:00.000Z',
      });
    });

    it('returns image null for a user without an avatar', async () => {
      const { cookie } = await signIn(newProfile());

      const res = await call('/api/me', { cookie });

      expect(((await read(res)) as { image: unknown }).image).toBeNull();
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
      const project = await prisma.project.create({
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
      await prisma.project.delete({ where: { id: project.id } });
    });

    it('user-updated refreshes the copy', async () => {
      const profile = newProfile({
        picture: 'https://auth.psstee.dev/api/avatars/a.png',
      });
      await signIn(profile);
      const newEmail = `${randomUUID()}@${api.emailDomain}`;

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

  describe('shared acceptance', () => {
    const consent = (cookie?: string) =>
      call('/api/users/me/consent', { method: 'POST', cookie });
    const protectedRoute = (cookie?: string) => call('/api/probe', { cookie });

    it('requires a session for the compatibility endpoint and protected routes', async () => {
      expect((await consent()).status).toBe(401);
      expect((await protectedRoute()).status).toBe(401);
    });

    it('returns central acceptance unchanged and never invents app-only history', async () => {
      const { cookie } = await signIn(newProfile());
      for (let i = 0; i < 2; i++) {
        const response = await consent(cookie);
        expect(response.status).toBe(200);
        expect(await read(response)).toEqual({
          consentGivenAt: '2026-10-21T00:00:00.000Z',
        });
      }
      expect(await read(await call('/api/me', { cookie }))).toMatchObject({
        consentGivenAt: null,
        unicorpTermsVersion: 1,
        unicorpTermsAcceptedAt: '2026-10-21T00:00:00.000Z',
      });
      expect((await protectedRoute(cookie)).status).toBe(404);
    });

    it('local acceptance cannot bypass missing shared evidence; a fresh UniAuth sign-in supplies it', async () => {
      const profile = newProfile({ sharedTerms: false });
      const { cookie } = await signIn(profile);
      await prisma.user.update({
        where: { email: profile.email },
        data: { consentGivenAt: new Date() },
      });
      expect((await protectedRoute(cookie)).status).toBe(403);
      expect((await consent(cookie)).status).toBe(403);
      await call('/api/auth/update-user', {
        method: 'POST',
        cookie,
        headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({
          unicorpTermsVersion: 1,
          unicorpTermsAcceptedAt: new Date().toISOString(),
        }),
      });
      expect((await protectedRoute(cookie)).status).toBe(403);
      const fresh = await signIn({ ...profile, sharedTerms: true });
      expect((await protectedRoute(fresh.cookie)).status).toBe(404);
    });

    it('account, health and signed event receivers remain reachable without shared acceptance', async () => {
      const { cookie } = await signIn(newProfile({ sharedTerms: false }));
      expect((await call('/health', { cookie })).status).toBe(200);
      expect((await call('/api/me', { cookie })).status).toBe(200);
      expect((await call('/api/auth/get-session', { cookie })).status).toBe(
        200,
      );
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
