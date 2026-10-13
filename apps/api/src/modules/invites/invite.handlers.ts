import type { Context } from 'hono';
import { apiSuccess, idParam, parseBody } from '@/http.js';
import { createInviteSchema } from './invite.schema.js';
import {
  createInvite,
  deleteInvite,
  getInvite,
  joinByInvite,
  previewInvite,
} from './invite.service.js';

export const getProjectInvite = async (c: Context) =>
  apiSuccess(c, await getInvite(idParam(c, 'projectId'), c.var.user.id));

export const postProjectInvite = async (c: Context) => {
  const input = await parseBody(c, createInviteSchema);
  return apiSuccess(
    c,
    await createInvite(idParam(c, 'projectId'), c.var.user.id, input),
    'Invite link created',
    201,
  );
};

export const deleteProjectInvite = async (c: Context) => {
  await deleteInvite(idParam(c, 'projectId'), c.var.user.id);
  return apiSuccess(c, null, 'Invite link deleted');
};

export const getInvitePreview = async (c: Context) =>
  apiSuccess(c, await previewInvite(c.req.param('token') ?? '', c.var.user.id));

export const postInviteJoin = async (c: Context) => {
  const { projectName, ...data } = await joinByInvite(
    c.req.param('token') ?? '',
    c.var.user.id,
  );
  return apiSuccess(c, data, `You joined ${projectName}`);
};
