import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteBlocker,
  deleteItemById,
  getDeletedItems,
  getItemById,
  getWorkspaceItems,
  patchItem,
  postBlocker,
  postRestoreItem,
  postWorkspaceItem,
} from './item.handlers.js';
import {
  addBlockerSchema,
  createItemSchema,
  deletedItemRowSchema,
  itemRowSchema,
  itemSchema,
  updateItemSchema,
} from './item.schema.js';

/** Work items: listed and created per workspace, then addressed by id. */
export const itemRoutes = new Hono();

itemRoutes.get(
  '/workspaces/:workspaceId/items',
  describe({
    tag: 'items',
    operationId: 'listItems',
    summary: "The workspace's items",
    pathParams: ['workspaceId'],
    data: z.array(itemRowSchema),
  }),
  getWorkspaceItems,
);
itemRoutes.post(
  '/workspaces/:workspaceId/items',
  describe({
    tag: 'items',
    operationId: 'createItem',
    summary: 'Create an item',
    pathParams: ['workspaceId'],
    body: createItemSchema,
    data: itemSchema,
    status: 201,
  }),
  postWorkspaceItem,
);
itemRoutes.get(
  '/workspaces/:workspaceId/items/deleted',
  describe({
    tag: 'items',
    operationId: 'listDeletedItems',
    summary: "The workspace's trash: deleted items, newest first",
    pathParams: ['workspaceId'],
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
