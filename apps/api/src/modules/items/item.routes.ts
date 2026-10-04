import { Hono } from 'hono';
import {
  deleteBlocker,
  deleteItemById,
  getItemById,
  getDeletedItems,
  getWorkspaceItems,
  patchItem,
  postBlocker,
  postRestoreItem,
  postWorkspaceItem,
} from './item.handlers.js';

/** Work items: listed and created per workspace, then addressed by id. */
export const itemRoutes = new Hono();

itemRoutes.get('/workspaces/:workspaceId/items', getWorkspaceItems);
itemRoutes.get('/workspaces/:workspaceId/items/deleted', getDeletedItems);
itemRoutes.post('/workspaces/:workspaceId/items', postWorkspaceItem);
itemRoutes.get('/items/:id', getItemById);
itemRoutes.patch('/items/:id', patchItem);
itemRoutes.delete('/items/:id', deleteItemById);
itemRoutes.post('/items/:id/restore', postRestoreItem);
itemRoutes.post('/items/:id/blockers', postBlocker);
itemRoutes.delete('/items/:id/blockers/:blockerId', deleteBlocker);
