import { randomUUID } from 'node:crypto';
import { startMockUniauth, type MockProfile } from './mock-uniauth.js';

export const WEB_ORIGIN = 'http://127.0.0.1:3013';
const CLIENT = { id: 'uniloom-test', secret: 'uniloom-test-secret' };

/**
 * Starts a mock uniAuth, points the auth settings at it, then imports the app (auth.ts reads
 * them on import). Returns helpers to call the API and sign people in.
 */
export async function startTestApi() {
  const uniauth = await startMockUniauth(CLIENT);
  Object.assign(process.env, {
    BETTER_AUTH_URL: WEB_ORIGIN,
    BETTER_AUTH_SECRET: 'e2e-secret-at-least-thirty-two-characters',
    UNIAUTH_ISSUER: uniauth.issuer,
    UNIAUTH_CLIENT_ID: CLIENT.id,
    UNIAUTH_CLIENT_SECRET: CLIENT.secret,
  });
  const { app } = await import('@/app.js');
  /** Test users get this email domain, so a test file can delete exactly its own. */
  const emailDomain = `e2e-${randomUUID()}.example`;

  /** A request to the API, as the web proxy would send it. */
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const { cookie, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (cookie) headers.set('cookie', cookie);
    return app.request(path, { ...rest, headers });
  };

  /** A JSON request with a session cookie. */
  const send = (method: string, path: string, cookie: string, body?: unknown) =>
    call(path, {
      method,
      cookie,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  function newProfile(overrides: Partial<MockProfile> = {}): MockProfile {
    return {
      sub: `u_${randomUUID()}`,
      email: `${randomUUID()}@${emailDomain}`,
      name: 'Mya',
      ...overrides,
    };
  }

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

  /** A signed-in user who has accepted the terms: ready for feature routes. */
  async function signInReady(profile = newProfile()) {
    const session = await signIn(profile);
    expect(
      (await send('POST', '/api/users/me/consent', session.cookie)).status,
    ).toBe(200);
    return { ...session, profile };
  }

  return {
    app,
    uniauth,
    emailDomain,
    call,
    send,
    newProfile,
    signIn,
    signInReady,
    close: () => uniauth.close(),
  };
}

/**
 * A response body: the `data` of a successful `{ success: true, message, data }`, or the
 * body as is (an error, or a Better Auth response).
 */
export async function read<T = any>(res: Response): Promise<T> {
  const body = await res.json();
  return body?.success === true ? body.data : body;
}
