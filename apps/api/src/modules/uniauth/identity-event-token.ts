import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const IDENTITY_EVENT = 'urn:uniauth:event:identity';
export const CONNECTION_CHECK_EVENT = 'urn:uniauth:event:connection-check';

/** A v1 identity event: no profile, only what changed for whom and in which version. */
export interface IdentityEvent {
  eventId: string;
  type: string;
  /** The person's uniAuth id. */
  subject: string;
  identityVersion: number;
}

export type IdentityEventResult =
  | { kind: 'event'; event: IdentityEvent }
  /** The dashboard's connection check: acknowledge, do nothing. */
  | { kind: 'check' }
  /** 401: a token uniAuth will retry (it may be signed by a key we have not fetched, or for an audience that is about to line up). */
  | { kind: 'unverified' }
  /** 400: a verified token with a body this receiver cannot use; uniAuth treats it as final. */
  | { kind: 'malformed' };

/**
 * Returns a function that verifies a v1 identity event token: signed with uniAuth's key, issued by it, for one of
 * this app's machine clients (several during a credential rotation), carrying exactly one event of a known kind and
 * schema version, about the token's own subject.
 */
export const createIdentityEventVerifier = (
  issuer: string,
  audiences: string[],
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${issuer}/jwks`)),
) => {
  return async (token: string): Promise<IdentityEventResult> => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        issuer,
        audience: audiences,
      }));
    } catch {
      return { kind: 'unverified' };
    }
    const events = payload.events as Record<string, unknown> | undefined;
    if (
      !events ||
      typeof events !== 'object' ||
      Object.keys(events).length !== 1 ||
      'nonce' in payload
    )
      return { kind: 'malformed' };
    if (CONNECTION_CHECK_EVENT in events) return { kind: 'check' };
    const event = events[IDENTITY_EVENT] as Record<string, unknown> | undefined;
    if (
      !event ||
      event.schemaVersion !== 1 ||
      typeof event.eventId !== 'string' ||
      typeof event.type !== 'string' ||
      typeof event.subject !== 'string' ||
      typeof event.identityVersion !== 'number' ||
      !Number.isInteger(event.identityVersion) ||
      payload.sub !== event.subject
    )
      return { kind: 'malformed' };
    return {
      kind: 'event',
      event: {
        eventId: event.eventId,
        type: event.type,
        subject: event.subject,
        identityVersion: event.identityVersion,
      },
    };
  };
};
