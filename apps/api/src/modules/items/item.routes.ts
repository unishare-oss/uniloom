import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteBlocker,
  deleteItemById,
  getDeletedItems,
  getItemById,
  getProjectItems,
  patchItem,
  postBlocker,
  postRestoreItem,
  postProjectItem,
} from './item.handlers.js';
import {
  addBlockerSchema,
  createItemSchema,
  deletedItemRowSchema,
  itemRowSchema,
  itemSchema,
  updateItemSchema,
} from './item.schema.js';

/** Work items: listed and created per project, then addressed by id. */
export const itemRoutes = new Hono();

itemRoutes.get(
  '/projects/:projectId/items',
  describe({
    tag: 'items',
    operationId: 'listItems',
    summary: "The project's items",
    pathParams: ['projectId'],
    data: z.array(itemRowSchema),
  }),
  getProjectItems,
);
itemRoutes.post(
  '/projects/:projectId/items',
  describe({
    tag: 'items',
    operationId: 'createItem',
    summary: 'Create an item',
    pathParams: ['projectId'],
    body: createItemSchema,
    data: itemSchema,
    status: 201,
  }),
  postProjectItem,
);
itemRoutes.get(
  '/projects/:projectId/items/deleted',
  describe({
    tag: 'items',
    operationId: 'listDeletedItems',
    summary: "The project's trash: deleted items, newest first",
    pathParams: ['projectId'],
    data: z.array(deletedItemRowSchema),
  }),
  getDeletedItems,
);
itemRoutes.get(
  '/items/:id',
  describe({
    tag: 'items',
    operationId: 'getItem',
    summary: 'One item',
    pathParams: ['id'],
    data: itemSchema,
  }),
  getItemById,
);
itemRoutes.patch(
  '/items/:id',
  describe({
    tag: 'items',
    operationId: 'updateItem',
    summary:
      "Update an item's title, description, priority, assignee, state or parent",
    pathParams: ['id'],
    body: updateItemSchema,
    data: itemSchema,
  }),
  patchItem,
);
itemRoutes.delete(
  '/items/:id',
  describe({
    tag: 'items',
    operationId: 'deleteItem',
    summary: 'Delete an item (it can be restored)',
    pathParams: ['id'],
    data: z.null(),
  }),
  deleteItemById,
);
itemRoutes.post(
  '/items/:id/restore',
  describe({
    tag: 'items',
    operationId: 'restoreItem',
    summary: 'Restore a deleted item',
    pathParams: ['id'],
    data: itemSchema,
  }),
  postRestoreItem,
);
itemRoutes.post(
  '/items/:id/blockers',
  describe({
    tag: 'items',
    operationId: 'addBlocker',
    summary: 'Record that this item waits on another',
    pathParams: ['id'],
    body: addBlockerSchema,
    data: itemSchema,
    status: 201,
  }),
  postBlocker,
);
itemRoutes.delete(
  '/items/:id/blockers/:blockerId',
  describe({
    tag: 'items',
    operationId: 'removeBlocker',
    summary: 'Remove a "waits on" link',
    pathParams: ['id', 'blockerId'],
    data: z.null(),
  }),
  deleteBlocker,
);
