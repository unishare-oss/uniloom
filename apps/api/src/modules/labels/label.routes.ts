import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteLabel,
  getLabels,
  patchLabel,
  postLabel,
} from './label.handlers.js';
import {
  createLabelSchema,
  labelSchema,
  updateLabelSchema,
} from './label.schema.js';

/** Mounted at `/`, like the member routes: each path starts with /projects/:projectId or /labels. */
export const labelRoutes = new Hono();

labelRoutes.get(
  '/projects/:projectId/labels',
  describe({
    tag: 'labels',
    operationId: 'listLabels',
    summary: "The project's labels, grouped ones first",
    pathParams: ['projectId'],
    data: z.array(labelSchema),
  }),
  getLabels,
);
labelRoutes.post(
  '/projects/:projectId/labels',
  describe({
    tag: 'labels',
    operationId: 'createLabel',
    summary: 'Add a label (owners and managers; a group is the owner’s)',
    pathParams: ['projectId'],
    body: createLabelSchema,
    data: labelSchema,
    status: 201,
  }),
  postLabel,
);
labelRoutes.patch(
  '/labels/:id',
  describe({
    tag: 'labels',
    operationId: 'updateLabel',
    summary:
      "Change a label's name and colour (owners and managers) or its group (owners)",
    pathParams: ['id'],
    body: updateLabelSchema,
    data: labelSchema,
  }),
  patchLabel,
);
labelRoutes.delete(
  '/labels/:id',
  describe({
    tag: 'labels',
    operationId: 'deleteLabel',
    summary: 'Delete a label; it leaves every item (owners)',
    pathParams: ['id'],
    data: z.null(),
  }),
  deleteLabel,
);
