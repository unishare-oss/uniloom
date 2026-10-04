import type { Context } from 'hono';
import { idParam, apiSuccess, parseBody } from '@/http.js';
import {
  addBlockerSchema,
  createItemSchema,
  updateItemSchema,
} from './item.schema.js';
import {
  addBlocker,
  createWorkspaceItem,
  getItem,
  listWorkspaceItems,
  removeBlocker,
  listWorkspaceDeletedItems,
  removeItem,
  restoreWorkspaceItem,
  updateWorkspaceItem,
} from './item.service.js';

export const getWorkspaceItems = async (c: Context) =>
  apiSuccess(
    c,
    await listWorkspaceItems(idParam(c, 'workspaceId'), c.var.user.id),
  );

export const getDeletedItems = async (c: Context) =>
  apiSuccess(
    c,
    await listWorkspaceDeletedItems(idParam(c, 'workspaceId'), c.var.user.id),
  );

export const postRestoreItem = async (c: Context) => {
  const item = await restoreWorkspaceItem(idParam(c, 'id'), c.var.user.id);
  return apiSuccess(c, item, `${item.key} restored`);
};

export const postWorkspaceItem = async (c: Context) => {
  const workspaceId = idParam(c, 'workspaceId');
  const input = await parseBody(c, createItemSchema);
  const item = await createWorkspaceItem(workspaceId, c.var.user.id, input);
  return apiSuccess(c, item, `${item.key} created`, 201);
};

export const getItemById = async (c: Context) =>
  apiSuccess(c, await getItem(idParam(c, 'id'), c.var.user.id));

export const patchItem = async (c: Context) => {
  const id = idParam(c, 'id');
  const input = await parseBody(c, updateItemSchema);
  const item = await updateWorkspaceItem(id, c.var.user.id, input);
  return apiSuccess(c, item, `${item.key} updated`);
};

export const deleteItemById = async (c: Context) => {
  await removeItem(idParam(c, 'id'), c.var.user.id);
  return apiSuccess(c, null, 'Item deleted');
};

export const postBlocker = async (c: Context) => {
  const id = idParam(c, 'id');
  const { blockerId } = await parseBody(c, addBlockerSchema);
  return apiSuccess(
    c,
    await addBlocker(id, c.var.user.id, blockerId),
    'Blocker added',
    201,
  );
};

export const deleteBlocker = async (c: Context) => {
  await removeBlocker(idParam(c, 'id'), c.var.user.id, idParam(c, 'blockerId'));
  return apiSuccess(c, null, 'Blocker removed');
};
