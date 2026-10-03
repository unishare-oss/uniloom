import { Hono } from 'hono';
import { getMe, postConsent } from './user.handlers.js';

/** The signed-in user, and accepting Uniloom's terms. Both work before consent. */
export const userRoutes = new Hono();

userRoutes.get('/me', getMe);
userRoutes.post('/users/me/consent', postConsent);
