import type { Context } from 'hono';
import { apiSuccess, idParam, parseBody } from '@/http.js';
import { addMemberSchema, changeRoleSchema } from './member.schema.js';
import {
  addMember,
  changeRole,
  listMembers,
  removeMember,
} from './member.service.js';

export const getMembers = async (c: Context) =>
  apiSuccess(c, await listMembers(idParam(c, 'projectId'), c.var.user.id));

export const postMember = async (c: Context) => {
  const input = await parseBody(c, addMemberSchema);
  return apiSuccess(
    c,
    await addMember(idParam(c, 'projectId'), c.var.user.id, input),
    'Member added',
    201,
  );
};

export const patchMember = async (c: Context) => {
  const { role } = await parseBody(c, changeRoleSchema);
  return apiSuccess(
    c,
    await changeRole(
      idParam(c, 'projectId'),
      c.var.user.id,
      c.req.param('userId') ?? '',
      role,
    ),
    'Role changed',
  );
};

export const deleteMember = async (c: Context) => {
  await removeMember(
    idParam(c, 'projectId'),
    c.var.user.id,
    c.req.param('userId') ?? '',
  );
  return apiSuccess(c, null, 'Member removed');
};
