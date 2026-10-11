import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { MCP_RESOURCE, UNIAUTH_ISSUER } from '@/auth/auth.js';
import { requireAgent } from './mcp.auth.js';
import { buildServer } from './mcp.server.js';

/** /mcp and its discovery documents. Mounted in app.ts, outside /api and the session. */
export const mcpRoutes = new Hono();

// RFC 9728: tells an MCP client which authorization server to sign in with.
const protectedResource = (c: Context) => {
  return c.json({
    resource: MCP_RESOURCE,
    authorization_servers: [UNIAUTH_ISSUER],
    bearer_methods_supported: ['header'],
  });
};
mcpRoutes.get('/.well-known/oauth-protected-resource', protectedResource);
mcpRoutes.get('/.well-known/oauth-protected-resource/mcp', protectedResource);

// Stateless: every request gets its own server and transport, thrown away after.
mcpRoutes.all('/mcp', requireAgent, async (c) => {
  const server = buildServer(c.var.agent);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});
