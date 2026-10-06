import type { Context } from 'hono';
import { idParam, apiSuccess, parseBody } from '@/http.js';
import {
  addBlockerSchema,
  addChecklistEntrySchema,
  createItemSchema,
  reorderChecklistSchema,
  updateChecklistEntrySchema,
  updateItemSchema,
} from './item.schema.js';
import {
  addBlocker,
  addChecklistEntry,
  createProjectItem,
  getItem,
  listProjectItems,
  removeBlocker,
  listProjectDeletedItems,
  removeChecklistEntry,
  removeItem,
  reorderChecklist,
  restoreProjectItem,
  updateChecklistEntry,
  updateProjectItem,
} from './item.service.js';

export const getProjectItems = async (c: Context) =>
  apiSuccess(c, await listProjectItems(idParam(c, 'projectId'), c.var.user.id));

export const getDeletedItems = async (c: Context) =>
  apiSuccess(
    c,
    await listProjectDeletedItems(idParam(c, 'projectId'), c.var.user.id),
  );

export const postRestoreItem = async (c: Context) => {
  const item = await restoreProjectItem(idParam(c, 'id'), c.var.user.id);
  return apiSuccess(c, item, `${item.key} restored`);
};

export const postProjectItem = async (c: Context) => {
  const projectId = idParam(c, 'projectId');
  const input = await parseBody(c, createItemSchema);
  const item = await createProjectItem(projectId, c.var.user.id, input);
  return apiSuccess(c, item, `${item.key} created`, 201);
};

export const getItemById = async (c: Context) =>
  apiSuccess(c, await getItem(idParam(c, 'id'), c.var.user.id));

export const patchItem = async (c: Context) => {
  const id = idParam(c, 'id');
  const input = await parseBody(c, updateItemSchema);
  const item = await updateProjectItem(id, c.var.user.id, input);
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

export const postChecklistEntry = async (c: Context) => {
  const id = idParam(c, 'id');
  const input = await parseBody(c, addChecklistEntrySchema);
  return apiSuccess(
    c,
    await addChecklistEntry(id, c.var.user.id, input),
    'Checklist entry added',
    201,
  );
};

export const patchChecklistEntry = async (c: Context) => {
  const id = idParam(c, 'id');
  const entryId = idParam(c, 'entryId');
  const input = await parseBody(c, updateChecklistEntrySchema);
  return apiSuccess(
    c,
    await updateChecklistEntry(id, entryId, c.var.user.id, input),
    'Checklist entry updated',
  );
};

export const deleteChecklistEntry = async (c: Context) => {
  await removeChecklistEntry(
    idParam(c, 'id'),
    idParam(c, 'entryId'),
    c.var.user.id,
  );
  return apiSuccess(c, null, 'Checklist entry deleted');
};

export const putChecklistOrder = async (c: Context) => {
  const id = idParam(c, 'id');
  const { ids } = await parseBody(c, reorderChecklistSchema);
  return apiSuccess(
    c,
    await reorderChecklist(id, c.var.user.id, ids),
    'Checklist reordered',
  );
};
