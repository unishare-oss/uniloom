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
  /** uniAuth's identity version: rises with every observable change. */
  version: number;
}

/** What provisioning needs of an identity: the version is known when it comes from the directory, not from a sign-in. */
export type LocalIdentity = Omit<DirectoryIdentity, 'version'> & {
  version?: number;
};

const TIMEOUT_MS = 5_000;

/**
 * The machine credential for uniAuth's directory. Both unset means the directory is off and
 * add-by-email only finds people who already signed in here. Only one of them set is a
 * mistake, so the API refuses to start instead of silently running without the directory.
 */
export const readDirectorySettings = (env = process.env) => {
  const id = env.UNIAUTH_DIRECTORY_CLIENT_ID;
  const secret = env.UNIAUTH_DIRECTORY_CLIENT_SECRET;
  if (!id && !secret) return null;
  if (!id || !secret)
    throw new Error(
      'Set both UNIAUTH_DIRECTORY_CLIENT_ID and UNIAUTH_DIRECTORY_CLIENT_SECRET, or neither',
    );
  return { id, secret, origin: new URL(UNIAUTH_ISSUER).origin };
};

// Checked when the module loads, which is at startup.
readDirectorySettings();

export const directoryEnabled = () => readDirectorySettings() !== null;

let cached: { value: string; refreshAt: number } | null = null;
let inFlight: Promise<string> | null = null;

const unavailable = (why: string) => {
  console.error(`[uniauth-directory] ${why}`);
  return apiError(
    503,
    'identity_service_unavailable',
    'The account service is not reachable right now. Try again shortly.',
  );
};

const fetchToken = async () => {
  const s = readDirectorySettings();
  if (!s) throw unavailable('directory credentials are not set');
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
  if (!res.ok) {
    await res.body?.cancel();
    throw unavailable(`token request answered ${res.status}`);
  }
  const body = (await res.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
  } | null;
  if (typeof body?.access_token !== 'string')
    throw unavailable('token response had no access_token');
  const lifetimeMs =
    (typeof body.expires_in === 'number' && body.expires_in > 0
      ? body.expires_in
      : 300) * 1000;
  // Renewed after 80% of its life, however long that is.
  cached = {
    value: body.access_token,
    refreshAt: Date.now() + lifetimeMs * 0.8,
  };
  return cached.value;
};

/**
 * A client_credentials token for the directory audience. Callers that need one at the same
 * moment share a single request.
 */
const accessToken = (refresh = false) => {
  if (!refresh && cached && cached.refreshAt > Date.now())
    return Promise.resolve(cached.value);
  inFlight ??= fetchToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

/** A request to the directory with the cached token; one fresh token and retry if it is refused. */
const send = async (method: 'GET' | 'POST', path: string, body?: unknown) => {
  const s = readDirectorySettings();
  if (!s) throw unavailable('directory credentials are not set');
  for (const refresh of [false, true]) {
    const token = await accessToken(refresh);
    let res: Response;
    try {
      res = await fetch(`${s.origin}/api/directory/v1${path}`, {
        method,
        headers: {
          ...(body !== undefined && { 'content-type': 'application/json' }),
          authorization: `Bearer ${token}`,
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw unavailable(`request failed: ${String(error)}`);
    }
    if (res.status !== 401 || refresh) return res;
    // Refused: free the connection before asking again with a new token.
    await res.body?.cancel();
  }
  throw unavailable('unreachable');
};

const STATUSES = ['active', 'suspended', 'deleted'];

/** The identity if the body is what the directory promises; otherwise null. */
const parseIdentity = (body: unknown): DirectoryIdentity | null => {
  const data = (body as { data?: Record<string, unknown> } | null)?.data;
  if (
    !data ||
    typeof data.id !== 'string' ||
    !data.id ||
    typeof data.name !== 'string' ||
    typeof data.email !== 'string' ||
    !data.email ||
    typeof data.emailVerified !== 'boolean' ||
    typeof data.version !== 'number' ||
    typeof data.status !== 'string' ||
    !STATUSES.includes(data.status) ||
    (data.image !== null && typeof data.image !== 'string')
  )
    return null;
  return data as unknown as DirectoryIdentity;
};

/**
 * Finds the uniAuth account for an exact email, whether or not it ever signed in here. Null
 * when there is no account that may be added: unknown, unverified, suspended and deleted look
 * the same to the caller, who must not learn which (the reason is only logged). Throws 503
 * `identity_service_unavailable` when uniAuth cannot answer or answers nonsense, never null:
 * an outage must not look like an unknown person.
 */
export const resolveIdentity = async (email: string) => {
  const res = await send('POST', '/users/resolve', { email });
  if (res.ok) {
    const identity = parseIdentity(await res.json().catch(() => null));
    if (!identity)
      throw unavailable('resolve answered 200 with an unexpected body');
    if (identity.status !== 'active' || !identity.emailVerified) {
      console.warn(`[uniauth-directory] not eligible: ${identity.status}`);
      return null;
    }
    return identity;
  }
  const code = (
    (await res.json().catch(() => null)) as {
      error?: { code?: string };
    } | null
  )?.error?.code;
  if (
    (res.status === 404 && code === 'identity_not_found') ||
    (res.status === 409 &&
      (code === 'identity_unverified' || code === 'identity_inactive'))
  ) {
    if (res.status === 409)
      console.warn(`[uniauth-directory] not eligible: ${code}`);
    return null;
  }
  throw unavailable(`resolve answered ${res.status} ${code ?? ''}`);
};

/** For tests: forget the cached token. */
export const resetDirectoryToken = () => {
  cached = null;
  inFlight = null;
};

/** One account by uniAuth id, or null if this client does not know it. Throws 503 when uniAuth cannot answer. */
export const readIdentity = async (id: string) => {
  const res = await send('GET', `/users/${encodeURIComponent(id)}`);
  if (res.ok) {
    const identity = parseIdentity(await res.json().catch(() => null));
    if (!identity)
      throw unavailable('read answered 200 with an unexpected body');
    return identity;
  }
  await res.body?.cancel();
  if (res.status === 404) return null;
  throw unavailable(`read answered ${res.status}`);
};

/** Up to 100 known ids at once. `deleted` carries a tombstone; `not_found` means this client does not know the id. */
export const batchIdentities = async (ids: string[]) => {
  const res = await send('POST', '/users/batch', { ids });
  if (!res.ok) {
    await res.body?.cancel();
    throw unavailable(`batch answered ${res.status}`);
  }
  const results = (
    (await res.json().catch(() => null)) as {
      data?: { results?: { id?: unknown; result?: unknown; data?: unknown }[] };
    } | null
  )?.data?.results;
  if (!Array.isArray(results))
    throw unavailable('batch answered 200 with an unexpected body');
  const byId = new Map<
    string,
    {
      result: 'found' | 'deleted' | 'not_found';
      identity: DirectoryIdentity | null;
    }
  >();
  for (const r of results) {
    if (
      typeof r.id !== 'string' ||
      !['found', 'deleted', 'not_found'].includes(String(r.result))
    )
      throw unavailable('batch answered 200 with an unexpected body');
    byId.set(r.id, {
      result: r.result as 'found' | 'deleted' | 'not_found',
      identity: r.result === 'found' ? parseIdentity({ data: r.data }) : null,
    });
  }
  return byId;
};

export interface DirectoryChange {
  eventId: string;
  type: string;
  id: string;
  version: number;
}

/** Thrown when the change feed's cursor is older than uniAuth's retention: refresh known ids with batch reads instead. */
export class ResyncRequired extends Error {}

/** Changes to accounts this client knows since `cursor`, in commit order (never identity.created). */
export const fetchChanges = async (cursor: string | null, limit = 100) => {
  const query = new URLSearchParams({
    limit: String(limit),
    ...(cursor && { cursor }),
  });
  const res = await send('GET', `/users/changes?${query}`);
  if (res.status === 410) {
    await res.body?.cancel();
    throw new ResyncRequired();
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw unavailable(`changes answered ${res.status}`);
  }
  const data = (
    (await res.json().catch(() => null)) as {
      data?: {
        changes?: DirectoryChange[];
        cursor?: string;
        hasMore?: boolean;
      };
    } | null
  )?.data;
  if (!data || !Array.isArray(data.changes) || typeof data.cursor !== 'string')
    throw unavailable('changes answered 200 with an unexpected body');
  return {
    changes: data.changes,
    cursor: data.cursor,
    hasMore: data.hasMore === true,
  };
};
