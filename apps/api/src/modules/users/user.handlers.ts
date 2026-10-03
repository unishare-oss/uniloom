import type { Context } from 'hono';
import { giveConsent, toMe } from './user.service.js';

export const getMe = (c: Context) => c.json(toMe(c.var.user));

export const postConsent = async (c: Context) =>
  c.json(await giveConsent(c.var.user.id));
