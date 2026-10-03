import { readAuthEnv } from './auth.js';

const ENV = {
  BETTER_AUTH_URL: 'http://127.0.0.1:3013',
  BETTER_AUTH_SECRET: 'secret-at-least-thirty-two-characters',
  UNIAUTH_ISSUER: 'http://localhost:3002/api/auth/',
  UNIAUTH_CLIENT_ID: 'uniloom',
  UNIAUTH_CLIENT_SECRET: 'secret',
};

describe('readAuthEnv', () => {
  it('reads every setting and trims the issuer', () => {
    expect(readAuthEnv(ENV)).toEqual({
      baseURL: 'http://127.0.0.1:3013',
      secret: ENV.BETTER_AUTH_SECRET,
      uniauthIssuer: 'http://localhost:3002/api/auth',
      uniauthClientId: 'uniloom',
      uniauthClientSecret: 'secret',
    });
  });

  it.each(Object.keys(ENV))('refuses to start without %s', (key) => {
    expect(() => readAuthEnv({ ...ENV, [key]: '' })).toThrow(`Missing ${key}`);
  });
});
