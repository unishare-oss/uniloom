import type { HTTPException } from 'hono/http-exception';
import {
  directoryEnabled,
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

  it('maps answers: unknown is null; unverified and suspended are 409; the rest is 503', async () => {
    script = [token(), json(404, { error: { code: 'identity_not_found' } })];
    expect(await resolveIdentity('nobody@example.com')).toBeNull();

    script = [json(409, { error: { code: 'identity_unverified' } })];
    expect(await failure(resolveIdentity('a@example.com'))).toEqual({
      status: 409,
      code: 'identity_unverified',
    });
    script = [json(409, { error: { code: 'identity_inactive' } })];
    expect(await failure(resolveIdentity('a@example.com'))).toEqual({
      status: 409,
      code: 'identity_inactive',
    });
    for (const status of [403, 422, 429, 500, 503]) {
      script = [json(status, { error: { code: 'x' } })];
      expect(await failure(resolveIdentity('a@example.com'))).toEqual({
        status: 503,
        code: 'identity_service_unavailable',
      });
    }
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
