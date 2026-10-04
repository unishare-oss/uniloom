import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import { getWorkspaces, postWorkspace } from './workspace.handlers.js';
import { createWorkspaceSchema, workspaceSchema } from './workspace.schema.js';

/** The signed-in user's workspaces. */
export const workspaceRoutes = new Hono();

workspaceRoutes.post(
  '/',
  describe({
    tag: 'workspaces',
    operationId: 'createWorkspace',
    summary: "Create a workspace with its mode's states; you become its owner",
    body: createWorkspaceSchema,
    data: workspaceSchema,
    status: 201,
  }),
  postWorkspace,
);
workspaceRoutes.get(
  '/',
  describe({
    tag: 'workspaces',
    operationId: 'listWorkspaces',
    summary: 'Your workspaces',
    data: z.array(workspaceSchema),
  }),
  getWorkspaces,
);
