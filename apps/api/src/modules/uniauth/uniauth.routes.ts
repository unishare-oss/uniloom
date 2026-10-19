import { Hono } from 'hono';
import {
  backchannelLogout,
  identityEvent,
  userDeleted,
  userUpdated,
} from './uniauth.handlers.js';

/** Server-to-server form POSTs from uniAuth. The signed token is the authentication. */
export const uniauthRoutes = new Hono();

uniauthRoutes.post('/backchannel-logout', backchannelLogout);
uniauthRoutes.post('/user-deleted', userDeleted);
uniauthRoutes.post('/user-updated', userUpdated);
// v1 identity events (versioned, deduplicated). The legacy two above stay until uniAuth stops sending them.
uniauthRoutes.post('/identity-events', identityEvent);
