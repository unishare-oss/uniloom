import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  getDocumentById,
  getDocuments,
  patchDocument,
  postDocument,
} from './document.handlers.js';
import {
  createDocumentSchema,
  documentSchema,
  documentSummarySchema,
  listDocumentsQuerySchema,
  updateDocumentSchema,
} from './document.schema.js';

/** Mounted at `/`, like the label routes: each path starts with /projects/:projectId or /documents. */
export const documentRoutes = new Hono();

documentRoutes.get(
  '/projects/:projectId/documents',
  describe({
    tag: 'documents',
    operationId: 'listDocuments',
    summary:
      "The project's documents without bodies, newest edit first (members)",
    pathParams: ['projectId'],
    query: listDocumentsQuerySchema,
    data: z.array(documentSummarySchema),
  }),
  getDocuments,
);
documentRoutes.post(
  '/projects/:projectId/documents',
  describe({
    tag: 'documents',
    operationId: 'createDocument',
    summary: 'Write a document (owners and managers)',
    pathParams: ['projectId'],
    body: createDocumentSchema,
    data: documentSchema,
    status: 201,
  }),
  postDocument,
);
documentRoutes.get(
  '/documents/:id',
  describe({
    tag: 'documents',
    operationId: 'getDocument',
    summary: 'One document with its body (members)',
    pathParams: ['id'],
    data: documentSchema,
  }),
  getDocumentById,
);
documentRoutes.patch(
  '/documents/:id',
  describe({
    tag: 'documents',
    operationId: 'updateDocument',
    summary: 'Edit or archive a document (owners and managers)',
    pathParams: ['id'],
    body: updateDocumentSchema,
    data: documentSchema,
  }),
  patchDocument,
);
