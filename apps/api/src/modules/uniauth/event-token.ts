import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { EventVerifier } from './uniauth.types.js';

export const LOGOUT_EVENT =
  'http://schemas.openid.net/event/backchannel-logout';
export const USER_DELETED_EVENT = 'urn:uniauth:event:user-deleted';
export const USER_UPDATED_EVENT = 'urn:uniauth:event:user-updated';
const EVENTS = [LOGOUT_EVENT, USER_DELETED_EVENT, USER_UPDATED_EVENT];

const keySets = new Map<string, JWTVerifyGetKey>();

/** uniAuth's signing keys, fetched lazily and cached per issuer: ONE key set shared by every event verifier. */
export const uniauthKeys = (issuer: string): JWTVerifyGetKey => {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/jwks`));
    keySets.set(issuer, keys);
  }
  return keys;
};

/**
 * The core of every uniAuth event check: signed with uniAuth's key, issued by it, for one of `audience` (the login
 * client for the legacy notices, the machine client for v1 identity events), not expired. Null if any of that fails.
 */
export const verifyUniauthJwt = async (
  token: string,
  issuer: string,
  audience: string | string[],
  keys: JWTVerifyGetKey = uniauthKeys(issuer),
) => {
  try {
    return (await jwtVerify(token, keys, { issuer, audience })).payload;
  } catch {
    return null;
  }
};

/**
 * Returns a function that verifies a uniAuth event token: signed with uniAuth's key, for this
 * client, carrying exactly the expected event and no nonce (so an ID token can't pass as one).
 * It resolves to the uniAuth user id and the event's data, or null.
 */
export const createEventVerifier = (
  issuer: string,
  audience: string,
  keys: JWTVerifyGetKey = uniauthKeys(issuer),
): EventVerifier => {
  return async (token, event) => {
    try {
      const payload = await verifyUniauthJwt(token, issuer, audience, keys);
      if (!payload) return null;
      const events = payload.events as Record<string, unknown> | undefined;
      const data = events?.[event];
      if (!events || !data || typeof data !== 'object' || 'nonce' in payload)
        return null;
      // A logout token that also carries the deletion event must never delete anyone.
      if (EVENTS.some((other) => other !== event && other in events))
        return null;
      return typeof payload.sub === 'string'
        ? { sub: payload.sub, data: data as Record<string, unknown> }
        : null;
    } catch {
      return null;
    }
  };
};
