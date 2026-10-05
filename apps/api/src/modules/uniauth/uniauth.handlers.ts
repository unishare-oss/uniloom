import type { Context } from 'hono';
import { UNIAUTH_CLIENT_ID, UNIAUTH_ISSUER } from '@/auth/auth.js';
import {
  createEventVerifier,
  LOGOUT_EVENT,
  USER_DELETED_EVENT,
  USER_UPDATED_EVENT,
} from './event-token.js';
import { deleteUser, endSessions, updateUser } from './uniauth.service.js';

const verifyEvent = createEventVerifier(UNIAUTH_ISSUER, UNIAUTH_CLIENT_ID);

/** The verified event from a form field, or null for a missing or invalid token. */
const readEvent = async (c: Context, field: string, event: string) => {
  const token = (await c.req.parseBody())[field];
  return typeof token === 'string' ? verifyEvent(token, event) : null;
};

export const backchannelLogout = async (c: Context) => {
  const event = await readEvent(c, 'logout_token', LOGOUT_EVENT);
  if (!event) return c.text('invalid token', 400);
  await endSessions(event.sub);
  return c.body(null, 200);
};

export const userDeleted = async (c: Context) => {
  const event = await readEvent(c, 'token', USER_DELETED_EVENT);
  if (!event) return c.text('invalid token', 400);
  await deleteUser(event.sub);
  return c.body(null, 200);
};

export const userUpdated = async (c: Context) => {
  const event = await readEvent(c, 'token', USER_UPDATED_EVENT);
  if (!event) return c.text('invalid token', 400);
  await updateUser(event.sub, event.data);
  return c.body(null, 200);
};
