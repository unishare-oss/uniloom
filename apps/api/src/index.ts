import { app } from './app.js';
import { auth, UNIAUTH_ISSUER } from '@/auth/auth.js';
import { telemetry } from '@/telemetry.js';

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

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3011),
  fetch: app.fetch,
});

process.once('SIGTERM', async () => {
  await server.stop(false);
  await telemetry?.shutdown();
  process.exit(0);
});
