import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteMember,
  getMembers,
  patchMember,
  postMember,
} from './member.handlers.js';
import {
  addMemberSchema,
  changeRoleSchema,
  memberSchema,
} from './member.schema.js';

/** Mounted at `/`, like the item routes: each path starts with /projects/:projectId. */
export const memberRoutes = new Hono();

memberRoutes.get(
  '/projects/:projectId/members',
  describe({
    tag: 'members',
    operationId: 'listMembers',
    summary: 'The project members with their roles, owners first',
    pathParams: ['projectId'],
    data: z.array(memberSchema),
  }),
  getMembers,
);
memberRoutes.post(
  '/projects/:projectId/members',
  describe({
    tag: 'members',
    operationId: 'addMember',
    summary: 'Add someone who already has an account, by email (owners only)',
    pathParams: ['projectId'],
    body: addMemberSchema,
    data: memberSchema,
    status: 201,
  }),
  postMember,
);
memberRoutes.patch(
  '/projects/:projectId/members/:userId',
  describe({
    tag: 'members',
    operationId: 'changeMemberRole',
    summary: "Change a member's role (owners only)",
    pathParams: ['projectId'],
    body: changeRoleSchema,
    data: memberSchema,
  }),
  patchMember,
);
memberRoutes.delete(
  '/projects/:projectId/members/:userId',
  describe({
    tag: 'members',
    operationId: 'removeMember',
    summary: 'Remove a member (owners), or leave the project (yourself)',
    pathParams: ['projectId'],
    data: z.null(),
  }),
  deleteMember,
);
