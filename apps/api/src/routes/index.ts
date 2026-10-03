import { Hono } from 'hono';
import { auth } from '@/auth/auth.js';
import { requireConsent, requireSession } from '@/auth/middleware.js';
import { uniauthRoutes } from '@/modules/uniauth/uniauth.routes.js';
import { userRoutes } from '@/modules/users/user.routes.js';

/** Every route under /api, in one place. Order matters: see the comments. */
export const apiRoutes = new Hono();

// Public.
apiRoutes.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));
apiRoutes.route('/uniauth', uniauthRoutes);

// Signed in, before consent.
apiRoutes.use(requireSession);
apiRoutes.route('/', userRoutes);

// Signed in and consented: mount every feature router below.
apiRoutes.use(requireConsent);
