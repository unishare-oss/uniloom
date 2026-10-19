import { UNIAUTH_ISSUER } from '@/auth/auth.js';
import { apiError } from '@/http.js';

/** What uniAuth's directory says about one account (only the fields Uniloom uses). */
export interface DirectoryIdentity {
  /** The uniAuth user id: the OIDC `sub`. */
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  status: 'active' | 'suspended' | 'deleted';
}

const TIMEOUT_MS = 5_000;

/**
 * The machine credential for uniAuth's directory, from the environment. Both unset means the
 * directory is off and add-by-email only finds people who already signed in here.
 */
const settings = () => {
  const id = process.env.UNIAUTH_DIRECTORY_CLIENT_ID;
  const secret = process.env.UNIAUTH_DIRECTORY_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret, origin: new URL(UNIAUTH_ISSUER).origin };
};

export const directoryEnabled = () => settings() !== null;

let cached: { value: string; expiresAt: number } | null = null;

const unavailable = (why: string) => {
  console.error(`[uniauth-directory] ${why}`);
  return apiError(
    503,
    'identity_service_unavailable',
    'The account service is not reachable right now. Try again shortly.',
  );
};

/** A client_credentials token for the directory audience, kept until shortly before it expires. */
const accessToken = async (refresh = false) => {
  const s = settings();
  if (!s) throw unavailable('directory credentials are not set');
  if (!refresh && cached && cached.expiresAt > Date.now() + 30_000)
    return cached.value;
  let res: Response;
  try {
    res = await fetch(`${UNIAUTH_ISSUER}/oauth2/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${btoa(`${s.id}:${s.secret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        resource: `${s.origin}/api/directory`,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw unavailable(`token request failed: ${String(error)}`);
  }
  if (!res.ok) throw unavailable(`token request answered ${res.status}`);
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token)
    throw unavailable('token response had no access_token');
  cached = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 300) * 1000,
  };
  return cached.value;
};

/** POST to the directory with the cached token; one fresh token and retry if it is refused. */
const post = async (path: string, body: unknown) => {
  const s = settings();
  if (!s) throw unavailable('directory credentials are not set');
  for (const refresh of [false, true]) {
    const token = await accessToken(refresh);
    let res: Response;
    try {
      res = await fetch(`${s.origin}/api/directory/v1${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw unavailable(`request failed: ${String(error)}`);
    }
    if (res.status !== 401 || refresh) return res;
  }
  throw unavailable('unreachable');
};

/**
 * Finds the uniAuth account for an exact email, whether or not it ever signed in here. Null if
 * there is none. Throws 409 `identity_unverified` / `identity_inactive` for an account that may
 * not be added yet, and 503 `identity_service_unavailable` when uniAuth cannot answer (never
 * "not found": an outage must not look like an unknown person).
 */
export const resolveIdentity = async (email: string) => {
  const res = await post('/users/resolve', { email });
  if (res.ok) {
    const { data } = (await res.json()) as { data: DirectoryIdentity };
    return data;
  }
  const code = (
    (await res.json().catch(() => null)) as { error?: { code?: string } } | null
  )?.error?.code;
  if (res.status === 404 && code === 'identity_not_found') return null;
  if (res.status === 409 && code === 'identity_unverified')
    throw apiError(
      409,
      'identity_unverified',
      'That account has not verified its email yet, so it cannot be added by email. Share an invite link instead.',
    );
  if (res.status === 409 && code === 'identity_inactive')
    throw apiError(409, 'identity_inactive', 'That account is suspended');
  throw unavailable(`resolve answered ${res.status} ${code ?? ''}`);
};

/** For tests: forget the cached token. */
export const resetDirectoryToken = () => {
  cached = null;
};
