import { Hono } from 'hono';
import { getWorkspaces, postWorkspace } from './workspace.handlers.js';

/** The signed-in user's workspaces. */
export const workspaceRoutes = new Hono();

workspaceRoutes.post('/', postWorkspace);
workspaceRoutes.get('/', getWorkspaces);
