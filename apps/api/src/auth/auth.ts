import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth } from 'better-auth/plugins';
import { prisma } from '@/db/prisma.js';
import { sharedTerms } from './shared-terms.js';

import { UNIAUTH_PROVIDER_ID } from '@/auth/constants.js';
import {
  ensureLocalUser,
  saveSharedAcceptance,
} from '@/modules/uniauth/uniauth.service.js';

export { UNIAUTH_PROVIDER_ID };

export interface AuthEnv {
  /** The web origin: it proxies /api to this server, so the session cookie lives there. */
  baseURL: string;
  secret: string;
  /** e.g. https://auth.psstee.dev/api/auth */
  uniauthIssuer: string;
  uniauthClientId: string;
  uniauthClientSecret: string;
  /** Uniloom's /mcp URL on the web origin, e.g. http://127.0.0.1:3013/mcp. */
  mcpResource: string;
}

/** Reads the auth settings. The API refuses to start without any of them. */
export const readAuthEnv = (env = process.env): AuthEnv => {
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
    mcpResource: required('MCP_RESOURCE'),
  };
};

const DAY = 60 * 60 * 24;
const env = readAuthEnv();

export const UNIAUTH_ISSUER = env.uniauthIssuer;
export const UNIAUTH_CLIENT_ID = env.uniauthClientId;
/** The audience agent tokens must carry (the MCP resource). */
export const MCP_RESOURCE = env.mcpResource;

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
          mapProfileToUser: async (profile) => {
            const user = {
              ...sharedTerms(profile),
              email: String(profile.email),
              emailVerified: profile.email_verified === true,
              name: String(profile.name || profile.email),
              // '' = no avatar: Better Auth skips an undefined image, so a removed uniAuth
              // avatar would never clear. The database hooks store '' as null.
              image: typeof profile.picture === 'string' ? profile.picture : '',
            };
            // Make the local user and its link first, the same way add-by-email does, so a
            // sign-in racing an add meets one row and Better Auth only ever finds it. A
            // conflict (the email is another user's) is left for Better Auth to report.
            if (typeof profile.sub === 'string') {
              const localId = await ensureLocalUser({
                id: profile.sub,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image || null,
                status: 'active',
              }).catch((error: unknown) => {
                console.error(
                  '[uniauth] could not prepare the local user:',
                  String(error),
                );
              });
              if (localId)
                await saveSharedAcceptance(localId, sharedTerms(profile));
            }
            return user;
          },
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
      // Historical app-only consent, retained separately from shared evidence.
      consentGivenAt: { type: 'date', required: false, input: false },
      unicorpTermsVersion: { type: 'number', required: false, input: false },
      unicorpTermsAcceptedAt: { type: 'date', required: false, input: false },
      // uniAuth's account state (active | suspended), set from its identity events, never from a request.
      identityStatus: { type: 'string', required: false, input: false },
    },
  },
});

/** The signed-in user, with Uniloom's additional field. */
export type SessionUser = (typeof auth)['$Infer']['Session']['user'];

const noAvatarAsNull = <T extends { image?: string | null }>(data: T): T => {
  return data.image === '' ? { ...data, image: null } : data;
};
