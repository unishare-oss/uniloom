import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';

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
export async function startMockUniauth(client: { id: string; secret: string }) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  };
  const codes = new Map<string, PendingCode>();
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
    },
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
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
