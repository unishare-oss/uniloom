import type { HTTPException } from 'hono/http-exception';
import {
  directoryEnabled,
  readDirectorySettings,
  resetDirectoryToken,
  resolveIdentity,
} from './directory.client.js';

const identity = {
  id: 'u-1',
  name: 'Alice',
  email: 'alice@example.com',
  emailVerified: true,
  image: null,
  status: 'active',
};

const json = (status: number, body: unknown) => Response.json(body, { status });
const token = (value = 'tok-1') =>
  json(200, { access_token: value, expires_in: 300 });

const calls: { url: string; auth: string | null; body: string }[] = [];
let script: Response[] = [];

beforeEach(() => {
  calls.length = 0;
  script = [];
  resetDirectoryToken();
  vi.stubEnv('UNIAUTH_DIRECTORY_CLIENT_ID', 'loom');
  vi.stubEnv('UNIAUTH_DIRECTORY_CLIENT_SECRET', 'secret');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      calls.push({
        url,
        auth: headers.get('authorization'),
        body:
          init.body instanceof URLSearchParams
            ? init.body.toString()
            : typeof init.body === 'string'
              ? init.body
              : '',
      });
      return Promise.resolve(script.shift() ?? json(500, {}));
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const failure = async (promise: Promise<unknown>) => {
  const error = (await promise.then(
    () => null,
    (e: unknown) => e,
  )) as HTTPException | null;
  expect(error).not.toBeNull();
  const body = (await error!.getResponse().json()) as { code: string };
  return { status: error!.status, code: body.code };
};

describe('uniAuth directory client', () => {
  it('is off unless both credentials are set', () => {
    expect(directoryEnabled()).toBe(true);
    vi.stubEnv('UNIAUTH_DIRECTORY_CLIENT_ID', '');
    vi.stubEnv('UNIAUTH_DIRECTORY_CLIENT_SECRET', '');
    expect(directoryEnabled()).toBe(false);
  });

  it('asks for a client_credentials token for the directory audience, once, and reuses it', async () => {
    script = [
      token(),
      json(200, { data: identity }),
      json(200, { data: identity }),
    ];
    expect((await resolveIdentity('alice@example.com'))?.id).toBe('u-1');
    await resolveIdentity('alice@example.com');
    expect(calls).toHaveLength(3); // one token request, two resolves
    expect(calls[0]!.url).toBe('http://127.0.0.1:1/api/auth/oauth2/token');
    expect(calls[0]!.auth).toBe(`Basic ${btoa('loom:secret')}`);
    expect(calls[0]!.body).toContain('grant_type=client_credentials');
    expect(calls[0]!.body).toContain(
      encodeURIComponent('http://127.0.0.1:1/api/directory'),
    );
    expect(calls[1]).toMatchObject({
      url: 'http://127.0.0.1:1/api/directory/v1/users/resolve',
      auth: 'Bearer tok-1',
    });
    expect(calls[1]!.body).toBe('{"email":"alice@example.com"}');
  });

  it('gets one fresh token and retries when the token is refused', async () => {
    script = [
      token('old'),
      json(401, { error: { code: 'invalid_token' } }),
      token('new'),
      json(200, { data: identity }),
    ];
    expect((await resolveIdentity('alice@example.com'))?.id).toBe('u-1');
    expect(calls.map((c) => c.auth)).toEqual([
      expect.stringContaining('Basic'),
      'Bearer old',
      expect.stringContaining('Basic'),
      'Bearer new',
    ]);
  });

  it('maps answers: unknown, unverified, suspended and deleted are all null; the rest is 503', async () => {
    script = [token(), json(404, { error: { code: 'identity_not_found' } })];
    expect(await resolveIdentity('nobody@example.com')).toBeNull();

    for (const code of ['identity_unverified', 'identity_inactive']) {
      script = [json(409, { error: { code } })];
      expect(await resolveIdentity('a@example.com')).toBeNull();
    }
    for (const status of [403, 422, 429, 500, 503]) {
      script = [json(status, { error: { code: 'x' } })];
      expect(await failure(resolveIdentity('a@example.com'))).toEqual({
        status: 503,
        code: 'identity_service_unavailable',
      });
    }
  });

  it('treats a 200 for a suspended, deleted or unverified account as not eligible', async () => {
    let cachedToken = false;
    for (const patch of [
      { status: 'suspended' },
      { status: 'deleted' },
      { emailVerified: false },
    ]) {
      script = [
        ...(cachedToken ? [] : [token()]),
        json(200, { data: { ...identity, ...patch } }),
      ];
      cachedToken = true;
      expect(await resolveIdentity('a@example.com')).toBeNull();
    }
  });

  it('answers 503 for a 200 whose body is not an identity', async () => {
    let cachedToken = false;
    for (const body of [
      {},
      { data: null },
      { data: { id: 'u-1' } },
      { data: { ...identity, status: 'weird' } },
      { data: { ...identity, emailVerified: 'yes' } },
    ]) {
      script = [...(cachedToken ? [] : [token()]), json(200, body)];
      cachedToken = true;
      expect(await failure(resolveIdentity('a@example.com'))).toEqual({
        status: 503,
        code: 'identity_service_unavailable',
      });
    }
  });

  it('shares one token request between simultaneous lookups', async () => {
    script = [
      token(),
      json(200, { data: identity }),
      json(200, { data: identity }),
      json(200, { data: identity }),
    ];
    await Promise.all([
      resolveIdentity('a@example.com'),
      resolveIdentity('b@example.com'),
      resolveIdentity('c@example.com'),
    ]);
    expect(calls.filter((c) => c.url.endsWith('/oauth2/token'))).toHaveLength(
      1,
    );
  });

  it('renews a short-lived token after 80% of its life instead of a fixed margin', async () => {
    vi.useFakeTimers();
    try {
      script = [
        json(200, { access_token: 'short', expires_in: 10 }),
        json(200, { data: identity }),
        json(200, { data: identity }),
        token('next'),
        json(200, { data: identity }),
      ];
      await resolveIdentity('a@example.com');
      vi.advanceTimersByTime(7_000); // 70% of 10 s: still the same token
      await resolveIdentity('a@example.com');
      expect(calls.map((c) => c.auth)).toContain('Bearer short');
      expect(calls.filter((c) => c.url.endsWith('/oauth2/token'))).toHaveLength(
        1,
      );
      vi.advanceTimersByTime(2_000); // past 80%: renewed
      await resolveIdentity('a@example.com');
      expect(calls.filter((c) => c.url.endsWith('/oauth2/token'))).toHaveLength(
        2,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses to start with only one of the two credentials set', () => {
    expect(readDirectorySettings({})).toBeNull();
    expect(() =>
      readDirectorySettings({ UNIAUTH_DIRECTORY_CLIENT_ID: 'x' }),
    ).toThrow(/both/);
    expect(() =>
      readDirectorySettings({ UNIAUTH_DIRECTORY_CLIENT_SECRET: 'y' }),
    ).toThrow(/both/);
    expect(
      readDirectorySettings({
        UNIAUTH_DIRECTORY_CLIENT_ID: 'x',
        UNIAUTH_DIRECTORY_CLIENT_SECRET: 'y',
      }),
    ).toMatchObject({ id: 'x', origin: 'http://127.0.0.1:1' });
  });

  it('answers 503, not "not found", when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    );
    resetDirectoryToken();
    expect(await failure(resolveIdentity('a@example.com'))).toEqual({
      status: 503,
      code: 'identity_service_unavailable',
    });
  });
});
