export const WEB_ORIGIN = 'http://127.0.0.1:3013';

/**
 * Points the auth settings at `issuer` (a mock uniAuth), then imports the app. auth.ts
 * reads them on import, so this must run before anything imports the app.
 */
export async function loadApp(
  issuer: string,
  client: { id: string; secret: string },
) {
  Object.assign(process.env, {
    BETTER_AUTH_URL: WEB_ORIGIN,
    BETTER_AUTH_SECRET: 'e2e-secret-at-least-thirty-two-characters',
    UNIAUTH_ISSUER: issuer,
    UNIAUTH_CLIENT_ID: client.id,
    UNIAUTH_CLIENT_SECRET: client.secret,
  });
  const { app } = await import('@/app.js');
  return app;
}
