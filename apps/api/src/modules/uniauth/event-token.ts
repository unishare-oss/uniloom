import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const LOGOUT_EVENT =
  'http://schemas.openid.net/event/backchannel-logout';
export const USER_DELETED_EVENT = 'urn:uniauth:event:user-deleted';
export const USER_UPDATED_EVENT = 'urn:uniauth:event:user-updated';
const EVENTS = [LOGOUT_EVENT, USER_DELETED_EVENT, USER_UPDATED_EVENT];

export interface UniauthEvent {
  sub: string;
  data: Record<string, unknown>;
}

export type EventVerifier = (
  token: string,
  event: string,
) => Promise<UniauthEvent | null>;

/**
 * Returns a function that verifies a uniAuth event token: signed with uniAuth's key, for this
 * client, carrying exactly the expected event and no nonce (so an ID token can't pass as one).
 * It resolves to the uniAuth user id and the event's data, or null.
 */
export function createEventVerifier(
  issuer: string,
  audience: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${issuer}/jwks`)),
): EventVerifier {
  return async (token, event) => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience });
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
}
