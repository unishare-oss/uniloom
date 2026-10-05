import type { Context } from 'hono';
import { apiSuccess } from '@/http.js';
import { giveConsent, toMe } from './user.service.js';

export const getMe = (c: Context) => apiSuccess(c, toMe(c.var.user));

export const postConsent = async (c: Context) =>
  apiSuccess(c, await giveConsent(c.var.user.id), 'Terms accepted');
