import { app } from './app.js';
import { auth, UNIAUTH_ISSUER } from '@/auth/auth.js';

// Better Auth reads uniAuth's discovery document once, when it starts. If uniAuth can't be
// reached then, sign-in stays broken until a restart, so refuse to start instead.
const discovery = await fetch(
  `${UNIAUTH_ISSUER}/.well-known/openid-configuration`,
).catch(() => null);
if (!discovery?.ok)
  throw new Error(
    `uniAuth is not reachable at ${UNIAUTH_ISSUER}; start it first`,
  );
await auth.$context;

export default {
  port: Number(process.env.PORT ?? 3011),
  fetch: app.fetch,
};
