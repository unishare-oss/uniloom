import type { Context } from 'hono';
import { UNIAUTH_CLIENT_ID, UNIAUTH_ISSUER } from '@/auth/auth.js';
import {
  createEventVerifier,
  LOGOUT_EVENT,
  USER_DELETED_EVENT,
  USER_UPDATED_EVENT,
} from './event-token.js';
import { deleteUser, endSessions, updateUser } from './uniauth.service.js';
import { createIdentityEventVerifier } from './identity-event-token.js';
import {
  applyIdentityEvent,
  NotYetConsistent,
} from './identity-events.service.js';

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

/**
 * The machine clients whose tokens carry v1 identity events for this app: UNIAUTH_DIRECTORY_CLIENT_ID, plus
 * UNIAUTH_EVENTS_EXTRA_AUDIENCES (comma-separated) while a credential rotation overlaps and events may still name the
 * old one.
 */
const eventAudiences = () =>
  [
    process.env.UNIAUTH_DIRECTORY_CLIENT_ID,
    ...(process.env.UNIAUTH_EVENTS_EXTRA_AUDIENCES ?? '').split(','),
  ]
    .map((a) => a?.trim())
    .filter((a): a is string => !!a);

let identityVerifier:
  ReturnType<typeof createIdentityEventVerifier> | undefined;

/**
 * v1 identity events from uniAuth (`identity_events_uri`): a form POST with `token`. Answers 204 once the change is
 * committed (or it was a duplicate, stale, or about nobody here), 401 for a token it cannot verify, 400 for one it
 * cannot use, 503 when it could not finish (uniAuth retries).
 */
export const identityEvent = async (c: Context) => {
  const audiences = eventAudiences();
  if (!audiences.length)
    return c.text('identity events are not configured', 503);
  identityVerifier ??= createIdentityEventVerifier(UNIAUTH_ISSUER, audiences);
  const token = (await c.req.parseBody())['token'];
  if (typeof token !== 'string') return c.text('invalid token', 400);
  const result = await identityVerifier(token);
  if (result.kind === 'unverified') return c.text('invalid token', 401);
  if (result.kind === 'malformed') return c.text('invalid event', 400);
  if (result.kind === 'event') {
    try {
      await applyIdentityEvent(result.event);
    } catch (error) {
      // A read that is behind the event: uniAuth retries.
      if (error instanceof NotYetConsistent)
        return c.text('the directory is not yet consistent; retry', 503);
      throw error;
    }
  }
  return c.body(null, 204);
};
