import type { SessionUser } from '@/auth/auth.js';
import type { Agent } from '@/modules/mcp/mcp.types.js';

// The signed-in user (set by requireSession) and the calling agent (set by requireAgent).
// Declared once, so every Hono context knows `c.var.user` without generics.
declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser;
    agent: Agent;
  }
}
