import { Hono } from 'hono';
import { describe } from '@/openapi.js';
import { getMe, postConsent } from './user.handlers.js';
import { consentSchema, meSchema } from './user.schema.js';

/** The signed-in user and existing shared acceptance; both work before the terms gate. */
export const userRoutes = new Hono();

userRoutes.get(
  '/me',
  describe({
    tag: 'users',
    operationId: 'getMe',
    summary: 'The signed-in user',
    data: meSchema,
  }),
  getMe,
);
userRoutes.post(
  '/users/me/consent',
  describe({
    tag: 'users',
    operationId: 'acceptTerms',
    summary:
      'Read shared Unicorp acceptance (complete missing acceptance through UniAuth)',
    data: consentSchema,
  }),
  postConsent,
);
