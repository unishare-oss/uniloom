import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteBlocker,
  deleteChecklistEntry,
  deleteItemById,
  getDeletedItems,
  getItemById,
  getProjectItems,
  patchChecklistEntry,
  patchItem,
  postBlocker,
  postChecklistEntry,
  postRestoreItem,
  postProjectItem,
  postMoveItem,
  putChecklistOrder,
} from './item.handlers.js';
import {
  addBlockerSchema,
  addChecklistEntrySchema,
  checklistEntrySchema,
  createItemSchema,
  deletedItemRowSchema,
  itemRowSchema,
  itemSchema,
  moveItemSchema,
  reorderChecklistSchema,
  updateChecklistEntrySchema,
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
    summary: 'Create an item (owners and managers)',
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
      "Update an item's title, description, priority, assignee or parent",
    pathParams: ['id'],
    body: updateItemSchema,
    data: itemSchema,
  }),
  patchItem,
);
itemRoutes.post(
  '/items/:id/move',
  describe({
    tag: 'items',
    operationId: 'moveItem',
    summary: 'Move an item to another state',
    pathParams: ['id'],
    body: moveItemSchema,
    data: itemSchema,
  }),
  postMoveItem,
);
itemRoutes.delete(
  '/items/:id',
  describe({
    tag: 'items',
    operationId: 'deleteItem',
    summary: 'Delete an item, restorable (owners and managers)',
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
    summary: 'Restore a deleted item (owners and managers)',
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
itemRoutes.post(
  '/items/:id/checklist',
  describe({
    tag: 'items',
    operationId: 'addChecklistEntry',
    summary: 'Add a done-when entry at the end of the checklist',
    pathParams: ['id'],
    body: addChecklistEntrySchema,
    data: checklistEntrySchema,
    status: 201,
  }),
  postChecklistEntry,
);
itemRoutes.put(
  '/items/:id/checklist/order',
  describe({
    tag: 'items',
    operationId: 'reorderChecklist',
    summary: 'Set the checklist order from a list of every entry id',
    pathParams: ['id'],
    body: reorderChecklistSchema,
    data: z.array(checklistEntrySchema),
  }),
  putChecklistOrder,
);
itemRoutes.patch(
  '/items/:id/checklist/:entryId',
  describe({
    tag: 'items',
    operationId: 'updateChecklistEntry',
    summary: "Edit an entry's text, tick or untick it, set its evidence",
    pathParams: ['id', 'entryId'],
    body: updateChecklistEntrySchema,
    data: checklistEntrySchema,
  }),
  patchChecklistEntry,
);
itemRoutes.delete(
  '/items/:id/checklist/:entryId',
  describe({
    tag: 'items',
    operationId: 'deleteChecklistEntry',
    summary: 'Delete an entry and close the gap',
    pathParams: ['id', 'entryId'],
    data: z.null(),
  }),
  deleteChecklistEntry,
);
