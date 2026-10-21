import { app } from './app.js';
import { auth, UNIAUTH_ISSUER } from '@/auth/auth.js';
import { telemetry } from '@/telemetry.js';
import { directoryEnabled } from '@/modules/uniauth/directory.client.js';
import { startIdentityReconcile } from '@/modules/uniauth/identity-events.service.js';

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

// Catch up with uniAuth's change feed now and periodically (what an offline spell or an exhausted delivery missed).
const stopReconcile = startIdentityReconcile(directoryEnabled());

process.once('SIGTERM', async () => {
  stopReconcile();
  await server.stop(false);
  await telemetry?.shutdown();
  process.exit(0);
});
