import { Hono } from 'hono';
import {
  backchannelLogout,
  userDeleted,
  userUpdated,
} from './uniauth.handlers.js';

/** Server-to-server form POSTs from uniAuth. The signed token is the authentication. */
export const uniauthRoutes = new Hono();

uniauthRoutes.post('/backchannel-logout', backchannelLogout);
uniauthRoutes.post('/user-deleted', userDeleted);
uniauthRoutes.post('/user-updated', userUpdated);
