import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteProjectInvite,
  getInvitePreview,
  getProjectInvite,
  postInviteJoin,
  postProjectInvite,
} from './invite.handlers.js';
import {
  createInviteSchema,
  invitePreviewSchema,
  inviteSchema,
  joinResultSchema,
} from './invite.schema.js';

/**
 * Mounted at `/`. A project has one invite link, so its routes have no id. `token` is
 * left out of `pathParams`: it is not a uuid.
 */
export const inviteRoutes = new Hono();

inviteRoutes.get(
  '/projects/:projectId/invite',
  describe({
    tag: 'invites',
    operationId: 'getInvite',
    summary:
      "The project's invite link, or null when it has none (owners, managers)",
    pathParams: ['projectId'],
    data: inviteSchema.nullable(),
  }),
  getProjectInvite,
);
inviteRoutes.post(
  '/projects/:projectId/invite',
  describe({
    tag: 'invites',
    operationId: 'createInvite',
    summary:
      'Create the invite link; the previous one stops working (owners, managers)',
    pathParams: ['projectId'],
    body: createInviteSchema,
    data: inviteSchema,
    status: 201,
  }),
  postProjectInvite,
);
inviteRoutes.delete(
  '/projects/:projectId/invite',
  describe({
    tag: 'invites',
    operationId: 'deleteInvite',
    summary: 'Delete the invite link: it stops working (owners, managers)',
    pathParams: ['projectId'],
    data: z.null(),
  }),
  deleteProjectInvite,
);
inviteRoutes.get(
  '/invites/:token',
  describe({
    tag: 'invites',
    operationId: 'previewInvite',
    summary: 'The project an invite link leads to, before joining',
    data: invitePreviewSchema,
  }),
  getInvitePreview,
);
inviteRoutes.post(
  '/invites/:token/join',
  describe({
    tag: 'invites',
    operationId: 'joinByInvite',
    summary: 'Join the project of an invite link as a Member',
    data: joinResultSchema,
  }),
  postInviteJoin,
);
