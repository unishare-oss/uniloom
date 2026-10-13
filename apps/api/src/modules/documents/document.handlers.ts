import type { Context } from 'hono';
import { apiError, apiSuccess, idParam, parseBody } from '@/http.js';
import {
  createDocumentSchema,
  listDocumentsQuerySchema,
  setDocumentStatusSchema,
  updateDocumentSchema,
} from './document.schema.js';
import {
  createDocument,
  getDocument,
  listDocuments,
  setDocumentStatus,
  updateDocumentById,
} from './document.service.js';

export const getDocuments = async (c: Context) => {
  const query = listDocumentsQuerySchema.safeParse(c.req.query());
  if (!query.success)
    throw apiError(400, 'invalid_input', 'Invalid document query');
  return apiSuccess(
    c,
    await listDocuments(idParam(c, 'projectId'), c.var.user.id, query.data),
  );
};

export const postDocument = async (c: Context) => {
  const input = await parseBody(c, createDocumentSchema);
  return apiSuccess(
    c,
    await createDocument(idParam(c, 'projectId'), c.var.user.id, input),
    'Document created',
    201,
  );
};

export const getDocumentById = async (c: Context) =>
  apiSuccess(c, await getDocument(idParam(c, 'id'), c.var.user.id));

export const patchDocument = async (c: Context) => {
  const input = await parseBody(c, updateDocumentSchema);
  return apiSuccess(
    c,
    await updateDocumentById(idParam(c, 'id'), c.var.user.id, input),
    'Document updated',
  );
};

export const postDocumentStatus = async (c: Context) => {
  const input = await parseBody(c, setDocumentStatusSchema);
  return apiSuccess(
    c,
    await setDocumentStatus(idParam(c, 'id'), c.var.user.id, input),
    'Status changed',
  );
};
