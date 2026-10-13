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
import { decideJoinRequest, listJoinRequests } from './request.service.js';

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
  return apiSuccess(
    c,
    data,
    data.result === 'joined' ? `You joined ${projectName}` : 'Request sent',
  );
};

export const getJoinRequests = async (c: Context) =>
  apiSuccess(c, await listJoinRequests(idParam(c, 'projectId'), c.var.user.id));

export const postApproveJoinRequest = async (c: Context) => {
  const name = await decideJoinRequest(
    idParam(c, 'projectId'),
    c.var.user.id,
    idParam(c, 'requestId'),
    true,
  );
  return apiSuccess(c, null, `${name} joined as a Member`);
};

export const postDeclineJoinRequest = async (c: Context) => {
  const name = await decideJoinRequest(
    idParam(c, 'projectId'),
    c.var.user.id,
    idParam(c, 'requestId'),
    false,
  );
  return apiSuccess(c, null, `Declined ${name}'s request`);
};
