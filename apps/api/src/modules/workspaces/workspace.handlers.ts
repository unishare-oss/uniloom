import type { Context } from 'hono';
import { apiSuccess, idParam, parseBody } from '@/http.js';
import { createWorkspaceSchema } from './workspace.schema.js';
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
} from './workspace.service.js';

export const postWorkspace = async (c: Context) => {
  const input = await parseBody(c, createWorkspaceSchema);
  return apiSuccess(
    c,
    await createWorkspace(c.var.user.id, input),
    'Workspace created',
    201,
  );
};

export const getWorkspaces = async (c: Context) =>
  apiSuccess(c, await listWorkspaces(c.var.user.id));

export const getWorkspaceById = async (c: Context) =>
  apiSuccess(c, await getWorkspace(idParam(c, 'workspaceId'), c.var.user.id));
