import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteProjectInvite,
  getInvitePreview,
  getJoinRequests,
  getProjectInvite,
  postApproveJoinRequest,
  postDeclineJoinRequest,
  postInviteJoin,
  postProjectInvite,
} from './invite.handlers.js';
import {
  createInviteSchema,
  invitePreviewSchema,
  inviteSchema,
  joinRequestSchema,
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
    summary:
      'Join the project of an invite link as a Member, or ask to when it needs approval',
    data: joinResultSchema,
  }),
  postInviteJoin,
);
inviteRoutes.get(
  '/projects/:projectId/join-requests',
  describe({
    tag: 'invites',
    operationId: 'listJoinRequests',
    summary: 'The people waiting to be let in, oldest first (owners, managers)',
    pathParams: ['projectId'],
    data: z.array(joinRequestSchema),
  }),
  getJoinRequests,
);
inviteRoutes.post(
  '/projects/:projectId/join-requests/:requestId/approve',
  describe({
    tag: 'invites',
    operationId: 'approveJoinRequest',
    summary: 'Let the person in as a Member (owners, managers)',
    pathParams: ['projectId', 'requestId'],
    data: z.null(),
  }),
  postApproveJoinRequest,
);
inviteRoutes.post(
  '/projects/:projectId/join-requests/:requestId/decline',
  describe({
    tag: 'invites',
    operationId: 'declineJoinRequest',
    summary: 'Decline the request; the person may ask again (owners, managers)',
    pathParams: ['projectId', 'requestId'],
    data: z.null(),
  }),
  postDeclineJoinRequest,
);
