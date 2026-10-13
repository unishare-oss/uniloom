import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  getDocumentById,
  getDocuments,
  patchDocument,
  postDocument,
  postDocumentStatus,
} from './document.handlers.js';
import {
  createDocumentSchema,
  documentSchema,
  documentSummarySchema,
  listDocumentsQuerySchema,
  setDocumentStatusSchema,
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
    summary:
      "Edit or archive a document (owners and managers; a ticket document follows the ticket's edit rule)",
    pathParams: ['id'],
    body: updateDocumentSchema,
    data: documentSchema,
  }),
  patchDocument,
);
documentRoutes.post(
  '/documents/:id/status',
  describe({
    tag: 'documents',
    operationId: 'setDocumentStatus',
    summary:
      "Move an ADR (accept, reject, supersede) or tech debt (fix, won't fix) to its next status (owners and managers)",
    pathParams: ['id'],
    body: setDocumentStatusSchema,
    data: documentSchema,
  }),
  postDocumentStatus,
);
