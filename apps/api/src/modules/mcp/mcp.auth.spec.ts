import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from 'jose';
import { createAgentVerifier, readBearer } from './mcp.auth.js';

const ISSUER = 'https://auth.example/api/auth';
const RESOURCE = 'https://uniloom.example/mcp';

describe('agent token', () => {
  let sign: (
    claims?: JWTPayload,
    key?: CryptoKey,
    expires?: string,
  ) => Promise<string>;
  let otherKey: CryptoKey;
  let verify: ReturnType<typeof createAgentVerifier>;

  beforeAll(async () => {
    const uniauth = await generateKeyPair('RS256');
    otherKey = (await generateKeyPair('RS256')).privateKey;
    const jwk = { ...(await exportJWK(uniauth.publicKey)), kid: 'k1' };
    verify = createAgentVerifier(
      ISSUER,
      RESOURCE,
      createLocalJWKSet({ keys: [jwk] }),
    );
    sign = (claims = {}, key = uniauth.privateKey, expires = '15m') =>
      new SignJWT({
        iss: ISSUER,
        aud: RESOURCE,
        sub: 'u_1',
        azp: 'claude',
        ...claims,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuedAt()
        .setExpirationTime(expires)
        .sign(key);
  });

  it('accepts a valid token and returns the sub and the client', async () => {
    expect(await verify(await sign())).toEqual({
      sub: 'u_1',
      clientId: 'claude',
    });
  });

  it('refuses another audience', async () => {
    expect(
      await verify(await sign({ aud: 'https://unishare.example/mcp' })),
    ).toBeNull();
  });

  it('refuses another issuer', async () => {
    expect(
      await verify(await sign({ iss: 'https://evil.example/api/auth' })),
    ).toBeNull();
  });

  it('refuses an expired token', async () => {
    expect(await verify(await sign({}, undefined, '-1m'))).toBeNull();
  });

  it('refuses a token signed with another key', async () => {
    expect(await verify(await sign({}, otherKey))).toBeNull();
  });

  it('refuses a token without a sub', async () => {
    expect(await verify(await sign({ sub: undefined }))).toBeNull();
  });
});

describe('readBearer', () => {
  it('reads the token of a Bearer header', () => {
    expect(readBearer('Bearer abc.def')).toBe('abc.def');
    expect(readBearer('bearer abc')).toBe('abc');
  });

  it('is null for anything else', () => {
    expect(readBearer(undefined)).toBeNull();
    expect(readBearer('Basic abc')).toBeNull();
  });
});
