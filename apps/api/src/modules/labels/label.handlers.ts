import type { Context } from 'hono';
import { apiSuccess, idParam, parseBody } from '@/http.js';
import { createLabelSchema, updateLabelSchema } from './label.schema.js';
import {
  createLabel,
  listLabels,
  removeLabel,
  updateLabel,
} from './label.service.js';

export const getLabels = async (c: Context) =>
  apiSuccess(c, await listLabels(idParam(c, 'projectId'), c.var.user.id));

export const postLabel = async (c: Context) => {
  const input = await parseBody(c, createLabelSchema);
  return apiSuccess(
    c,
    await createLabel(idParam(c, 'projectId'), c.var.user.id, input),
    'Label created',
    201,
  );
};

export const patchLabel = async (c: Context) => {
  const input = await parseBody(c, updateLabelSchema);
  return apiSuccess(
    c,
    await updateLabel(idParam(c, 'id'), c.var.user.id, input),
    'Label updated',
  );
};

export const deleteLabel = async (c: Context) => {
  await removeLabel(idParam(c, 'id'), c.var.user.id);
  return apiSuccess(c, null, 'Label deleted');
};
