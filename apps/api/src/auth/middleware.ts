import type { MiddlewareHandler } from 'hono';
import { auth } from './auth.js';

/**
 * Puts the signed-in user on the context, or answers 401. Reading the session slides it to
 * 7 more days at most once a day; the refreshed cookie is passed on to the response.
 */
export const requireSession: MiddlewareHandler = async (c, next) => {
  const { headers, response: session } = await auth.api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  if (!session)
    return c.json({ statusCode: 401, message: 'Unauthorized' }, 401);
  c.set('user', session.user);
  await next();
  for (const cookie of headers.getSetCookie())
    c.res.headers.append('set-cookie', cookie);
};

/**
 * Signing in through uniAuth is not agreeing to Uniloom's terms. Answers 403
 * consent_required until the user has accepted them. Runs after requireSession.
 */
export const requireConsent: MiddlewareHandler = async (c, next) => {
  if (!c.var.user.consentGivenAt) {
    return c.json(
      {
        statusCode: 403,
        code: 'consent_required',
        message: "Accept Uniloom's Terms and Privacy Policy first",
      },
      403,
    );
  }
  await next();
};
