import { Hono } from 'hono';
import { describe } from '@/openapi.js';
import { getMe, postConsent } from './user.handlers.js';
import { consentSchema, meSchema } from './user.schema.js';

/** The signed-in user, and accepting Uniloom's terms. Both work before consent. */
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
    summary: "Accept Uniloom's terms (the first time only)",
    data: consentSchema,
  }),
  postConsent,
);
