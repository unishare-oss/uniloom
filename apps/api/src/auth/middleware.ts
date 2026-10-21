import type { MiddlewareHandler } from 'hono';
import { apiError } from '@/http.js';
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
  if (!session) throw apiError(401, 'unauthorized', 'Sign in first');
  // Suspended on uniAuth: blocked here at once, even before their sessions are gone.
  if (session.user.identityStatus === 'suspended')
    throw apiError(403, 'account_suspended', 'This account is suspended');
  c.set('user', session.user);
  await next();
  for (const cookie of headers.getSetCookie())
    c.res.headers.append('set-cookie', cookie);
};

/**
 * Require recorded shared acceptance from a validated UniAuth sign-in.
 * App-only consent history is not shared acceptance. Runs after requireSession.
 */
export const requireConsent: MiddlewareHandler = async (c, next) => {
  if (
    c.var.user.unicorpTermsVersion !== 1 ||
    !c.var.user.unicorpTermsAcceptedAt
  )
    throw apiError(
      403,
      'consent_required',
      'Complete the shared Unicorp terms step through UniAuth',
    );
  await next();
};
