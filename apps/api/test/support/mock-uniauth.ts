import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';

/** The machine credential Uniloom's API uses for the directory (UNIAUTH_DIRECTORY_CLIENT_*). */
export const DIRECTORY_CLIENT = {
  id: 'uniloom-directory-test',
  secret: 'uniloom-directory-test-secret',
};

export interface MockProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface PendingCode {
  profile: MockProfile;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  nonce?: string;
}

/**
 * A minimal OIDC provider standing in for uniAuth: discovery, authorize (always signed in as
 * `profile`), token (Basic client auth + PKCE) and JWKS. ID tokens are RS256-signed.
 */
export const startMockUniauth = async (client: {
  id: string;
  secret: string;
}) => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  };
  const codes = new Map<string, PendingCode>();
  /** Accounts the mock directory knows: everyone who signed in, plus whoever a test registers. */
  const accounts = new Map<
    string,
    { profile: MockProfile; verified: boolean; status: 'active' | 'suspended' }
  >();
  const machineTokens = new Set<string>();
  const directory = { resolveCalls: 0, tokenCalls: 0, failWith: 0 };
  let profile: MockProfile | null = {
    sub: randomUUID(),
    email: 'mya@example.com',
    name: 'Mya',
  };
  let issuer = '';

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', issuer);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/api/auth/.well-known/openid-configuration') {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/oauth2/authorize`,
        token_endpoint: `${issuer}/oauth2/token`,
        userinfo_endpoint: `${issuer}/oauth2/userinfo`,
        jwks_uri: `${issuer}/jwks`,
        id_token_signing_alg_values_supported: ['RS256'],
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
      });
    }

    if (url.pathname === '/api/auth/jwks') return json(200, { keys: [jwk] });

    if (
      url.pathname === '/api/directory/v1/users/resolve' &&
      req.method === 'POST'
    ) {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        directory.resolveCalls++;
        const token = (req.headers.authorization ?? '').replace('Bearer ', '');
        if (!machineTokens.has(token))
          return json(401, { error: { code: 'invalid_token' } });
        if (directory.failWith)
          return json(directory.failWith, { error: { code: 'boom' } });
        const email = String(JSON.parse(raw).email ?? '')
          .trim()
          .toLowerCase();
        const found = accounts.get(email);
        if (!found) return json(404, { error: { code: 'identity_not_found' } });
        if (found.status === 'suspended')
          return json(409, { error: { code: 'identity_inactive' } });
        if (!found.verified)
          return json(409, { error: { code: 'identity_unverified' } });
        json(200, {
          data: {
            issuer,
            id: found.profile.sub,
            name: found.profile.name,
            email: found.profile.email,
            emailVerified: true,
            image: found.profile.picture ?? null,
            status: 'active',
            version: 1,
            updatedAt: new Date().toISOString(),
          },
        });
      });
      return;
    }

    if (url.pathname === '/api/auth/oauth2/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri') ?? '';
      const back = new URL(redirectUri);
      back.searchParams.set('state', url.searchParams.get('state') ?? '');
      if (!profile) {
        // Not signed in here: what uniAuth answers to prompt=none.
        back.searchParams.set('error', 'login_required');
        res.writeHead(302, { location: back.toString() });
        return res.end();
      }
      const code = randomUUID();
      codes.set(code, {
        profile,
        clientId: url.searchParams.get('client_id') ?? '',
        redirectUri,
        codeChallenge: url.searchParams.get('code_challenge') ?? '',
        nonce: url.searchParams.get('nonce') ?? undefined,
      });
      back.searchParams.set('code', code);
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }

    if (url.pathname === '/api/auth/oauth2/token' && req.method === 'POST') {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        void (async () => {
          const form = new URLSearchParams(raw);
          if (form.get('grant_type') === 'client_credentials') {
            directory.tokenCalls++;
            const machine = Buffer.from(
              `${DIRECTORY_CLIENT.id}:${DIRECTORY_CLIENT.secret}`,
            ).toString('base64');
            if (
              req.headers.authorization !== `Basic ${machine}` ||
              form.get('resource') !== `${new URL(issuer).origin}/api/directory`
            )
              return json(401, { error: 'invalid_client' });
            const accessToken = `machine-${randomUUID()}`;
            machineTokens.add(accessToken);
            return json(200, {
              access_token: accessToken,
              token_type: 'Bearer',
              expires_in: 300,
            });
          }
          const basic = Buffer.from(`${client.id}:${client.secret}`).toString(
            'base64',
          );
          const pending = codes.get(form.get('code') ?? '');
          codes.delete(form.get('code') ?? '');
          const verifier = form.get('code_verifier') ?? '';
          const challenge = createHash('sha256')
            .update(verifier)
            .digest('base64url');
          if (
            req.headers.authorization !== `Basic ${basic}` ||
            !pending ||
            pending.clientId !== client.id ||
            pending.redirectUri !== form.get('redirect_uri') ||
            pending.codeChallenge !== challenge
          ) {
            return json(400, { error: 'invalid_grant' });
          }
          const { sub, ...claims } = pending.profile;
          const idToken = await new SignJWT({
            ...claims,
            email_verified: true,
            ...(pending.nonce && { nonce: pending.nonce }),
          })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(issuer)
            .setAudience(client.id)
            .setSubject(sub)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
          json(200, {
            access_token: randomUUID(),
            refresh_token: randomUUID(),
            id_token: idToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email offline_access',
          });
        })();
      });
      return;
    }

    json(404, { error: 'not_found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;

  return {
    issuer,
    /** The person the next authorize request signs in as. null = signed out. */
    signInAs(next: MockProfile | null) {
      profile = next;
      if (next && !accounts.has(next.email.toLowerCase()))
        accounts.set(next.email.toLowerCase(), {
          profile: next,
          verified: true,
          status: 'active',
        });
    },
    /** An account that exists in uniAuth but has never signed in to Uniloom. */
    registerAccount(
      next: MockProfile,
      state: { verified?: boolean; status?: 'active' | 'suspended' } = {},
    ) {
      accounts.set(next.email.toLowerCase(), {
        profile: next,
        verified: state.verified ?? true,
        status: state.status ?? 'active',
      });
    },
    /** Counters and a switch to make the directory answer with an error status. */
    directory,
    /** Signs an event token the way uniAuth does for its server-to-server calls. */
    signEvent(sub: string, events: Record<string, object>) {
      return new SignJWT({ events })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(client.id)
        .setSubject(sub)
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime('2m')
        .sign(privateKey);
    },
    /** Signs an MCP access token the way uniAuth does; `claims` and `expires` override it. */
    signAgentToken(
      sub: string,
      audience: string,
      claims: Record<string, unknown> = {},
      expires = '15m',
    ) {
      return new SignJWT({ azp: 'claude-code-test', ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime(expires)
        .sign(privateKey);
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};
