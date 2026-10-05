import type { SessionUser } from '@/auth/auth.js';

// The signed-in user, set by requireSession. Declared once, so every Hono context knows
// `c.var.user` without generics.
declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser;
  }
}
