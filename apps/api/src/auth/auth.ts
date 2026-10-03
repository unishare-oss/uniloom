import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth } from 'better-auth/plugins';
import { prisma } from '@/db/prisma.js';

export const UNIAUTH_PROVIDER_ID = 'uniauth';

export interface AuthEnv {
  /** The web origin: it proxies /api to this server, so the session cookie lives there. */
  baseURL: string;
  secret: string;
  /** e.g. https://auth.psstee.dev/api/auth */
  uniauthIssuer: string;
  uniauthClientId: string;
  uniauthClientSecret: string;
}

/** Reads the auth settings. The API refuses to start without any of them. */
export function readAuthEnv(env = process.env): AuthEnv {
  const required = (key: string) => {
    const value = env[key];
    if (!value) throw new Error(`Missing ${key}`);
    return value;
  };
  return {
    baseURL: required('BETTER_AUTH_URL'),
    secret: required('BETTER_AUTH_SECRET'),
    uniauthIssuer: required('UNIAUTH_ISSUER').replace(/\/+$/, ''),
    uniauthClientId: required('UNIAUTH_CLIENT_ID'),
    uniauthClientSecret: required('UNIAUTH_CLIENT_SECRET'),
  };
}

const DAY = 60 * 60 * 24;
const env = readAuthEnv();

export const UNIAUTH_ISSUER = env.uniauthIssuer;
export const UNIAUTH_CLIENT_ID = env.uniauthClientId;

/** Better Auth with uniAuth as the only way in. Uniloom keeps its own session. */
export const auth = betterAuth({
  baseURL: env.baseURL,
  secret: env.secret,
  trustedOrigins: [env.baseURL],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // Host-only cookie with Uniloom's own name. Never crossSubDomainCookies.
  advanced: { cookiePrefix: 'uniloom' },
  // Sliding: an active user's session moves 7 days forward at most once a day.
  // No cookieCache, so a deleted session (sign-out, back-channel logout) ends at once.
  session: { expiresIn: 7 * DAY, updateAge: DAY },
  // No emailAndPassword and no socialProviders: people sign in on uniAuth only.
  plugins: [
    genericOAuth({
      config: [
        {
          // Callback: <BETTER_AUTH_URL>/api/auth/callback/uniauth
          providerId: UNIAUTH_PROVIDER_ID,
          discoveryUrl: `${env.uniauthIssuer}/.well-known/openid-configuration`,
          clientId: env.uniauthClientId,
          clientSecret: env.uniauthClientSecret,
          authentication: 'basic',
          pkce: true,
          requireIdTokenVerification: true,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          // Name and avatar are uniAuth's: refreshed at every sign-in.
          overrideUserInfo: true,
          mapProfileToUser: (profile) => ({
            email: String(profile.email),
            emailVerified: profile.email_verified === true,
            name: String(profile.name || profile.email),
            // '' = no avatar: Better Auth skips an undefined image, so a removed uniAuth
            // avatar would never clear. The database hooks store '' as null.
            image: typeof profile.picture === 'string' ? profile.picture : '',
          }),
        },
      ],
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: (user) => Promise.resolve({ data: noAvatarAsNull(user) }),
      },
      update: {
        before: (data) => Promise.resolve({ data: noAvatarAsNull(data) }),
      },
    },
  },
  user: {
    additionalFields: {
      // Set by Uniloom's consent screen, never at sign-up.
      consentGivenAt: { type: 'date', required: false, input: false },
    },
  },
});

/** The signed-in user, with Uniloom's additional field. */
export type SessionUser = (typeof auth)['$Infer']['Session']['user'];

function noAvatarAsNull<T extends { image?: string | null }>(data: T): T {
  return data.image === '' ? { ...data, image: null } : data;
}
