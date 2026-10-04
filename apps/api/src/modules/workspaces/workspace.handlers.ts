import type { Context } from 'hono';
import { apiSuccess, parseBody } from '@/http.js';
import { createWorkspaceSchema } from './workspace.schema.js';
import { createWorkspace, listWorkspaces } from './workspace.service.js';

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
