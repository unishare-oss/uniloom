import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { MiddlewareHandler } from 'hono';
import { MCP_RESOURCE, UNIAUTH_ISSUER } from '@/auth/auth.js';
import { apiError } from '@/http.js';
import * as mcpRepo from './mcp.repository.js';
import type { Agent } from './mcp.types.js';

/**
 * Returns a function that checks an agent's access token: signed by uniAuth, issued by
 * `issuer`, for `audience` (Uniloom's /mcp) and not expired. It resolves to the uniAuth
 * user id, the OAuth client id and its registered name (both null when the token has
 * none), or null.
 */
export const createAgentVerifier = (
  issuer: string,
  audience: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${issuer}/jwks`)),
) => {
  return async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience });
      if (typeof payload.sub !== 'string') return null;
      const client = payload.azp ?? payload.client_id;
      return {
        sub: payload.sub,
        clientId: typeof client === 'string' ? client : null,
        clientName:
          typeof payload.client_name === 'string' ? payload.client_name : null,
      };
    } catch {
      return null;
    }
  };
};

export const verifyAgentToken = createAgentVerifier(
  UNIAUTH_ISSUER,
  MCP_RESOURCE,
);

/** The token of an `Authorization: Bearer <token>` header, or null. */
export const readBearer = (header: string | undefined) => {
  return header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
};

/** What a client needs to find uniAuth (RFC 9728), sent with every 401. */
const challenge = () => {
  const url = new URL(
    '/.well-known/oauth-protected-resource/mcp',
    MCP_RESOURCE,
  );
  return `Bearer resource_metadata="${url.toString()}"`;
};

const unauthorized = (message: string) => {
  const error = apiError(401, 'unauthorized', message);
  error.res?.headers.set('WWW-Authenticate', challenge());
  return error;
};

/**
 * Puts the calling agent on the context, or answers 401 with the metadata link. A person
 * without a local identity and recorded current shared acceptance is refused too.
 */
export const requireAgent: MiddlewareHandler = async (c, next) => {
  const token = readBearer(c.req.header('authorization'));
  if (!token) throw unauthorized('Sign in first');
  const verified = await verifyAgentToken(token);
  if (!verified) throw unauthorized('Invalid or expired token');
  const user = await mcpRepo.findUserBySub(verified.sub);
  if (!user) throw unauthorized('Sign in to Uniloom on the website first');
  if (user.identityStatus === 'suspended')
    throw apiError(403, 'account_suspended', 'This account is suspended');
  if (user.unicorpTermsVersion !== 1 || !user.unicorpTermsAcceptedAt)
    throw apiError(
      403,
      'consent_required',
      'Complete the shared Unicorp terms step through UniAuth',
    );
  const agent: Agent = {
    userId: user.id,
    clientId: verified.clientId,
    clientName: verified.clientName,
  };
  c.set('agent', agent);
  await next();
};
