import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from 'jose';
import {
  createEventVerifier,
  LOGOUT_EVENT,
  USER_DELETED_EVENT,
} from './event-token.js';

const ISSUER = 'https://auth.example/api/auth';
const CLIENT_ID = 'uniloom';

describe('uniAuth event token', () => {
  let sign: (claims: JWTPayload, key?: CryptoKey) => Promise<string>;
  let otherKey: CryptoKey;
  let verify: ReturnType<typeof createEventVerifier>;

  beforeAll(async () => {
    const uniauth = await generateKeyPair('RS256');
    otherKey = (await generateKeyPair('RS256')).privateKey;
    const jwk = { ...(await exportJWK(uniauth.publicKey)), kid: 'k1' };
    verify = createEventVerifier(
      ISSUER,
      CLIENT_ID,
      createLocalJWKSet({ keys: [jwk] }),
    );
    sign = (claims, key = uniauth.privateKey) =>
      new SignJWT({
        iss: ISSUER,
        aud: CLIENT_ID,
        sub: 'u_1',
        events: { [LOGOUT_EVENT]: {} },
        ...claims,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuedAt()
        .setExpirationTime('2m')
        .sign(key);
  });

  it('accepts a valid logout token', async () => {
    expect(await verify(await sign({}), LOGOUT_EVENT)).toEqual({
      sub: 'u_1',
      data: {},
    });
  });

  it('rejects a token signed by another key', async () => {
    expect(await verify(await sign({}, otherKey), LOGOUT_EVENT)).toBeNull();
  });

  it('rejects the wrong audience', async () => {
    expect(await verify(await sign({ aud: 'other' }), LOGOUT_EVENT)).toBeNull();
  });

  it('rejects the wrong issuer', async () => {
    expect(
      await verify(await sign({ iss: 'https://evil.example' }), LOGOUT_EVENT),
    ).toBeNull();
  });

  it('rejects a token with a nonce', async () => {
    expect(await verify(await sign({ nonce: 'n' }), LOGOUT_EVENT)).toBeNull();
  });

  it('rejects a logout token that also carries the deletion event', async () => {
    const token = await sign({
      events: { [LOGOUT_EVENT]: {}, [USER_DELETED_EVENT]: {} },
    });
    expect(await verify(token, LOGOUT_EVENT)).toBeNull();
    expect(await verify(token, USER_DELETED_EVENT)).toBeNull();
  });

  it('rejects a token without the expected event', async () => {
    expect(await verify(await sign({}), USER_DELETED_EVENT)).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await verify('not-a-jwt', LOGOUT_EVENT)).toBeNull();
  });
});
