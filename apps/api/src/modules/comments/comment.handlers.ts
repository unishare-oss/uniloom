import type { Context } from 'hono';
import { apiSuccess, idParam, parseBody } from '@/http.js';
import { createCommentSchema, updateCommentSchema } from './comment.schema.js';
import {
  createDocumentComment,
  createItemComment,
  deleteComment,
  listDocumentComments,
  listItemComments,
  updateComment,
} from './comment.service.js';

export const getItemComments = async (c: Context) =>
  apiSuccess(c, await listItemComments(idParam(c, 'id'), c.var.user.id));

export const postItemComment = async (c: Context) => {
  const id = idParam(c, 'id');
  const input = await parseBody(c, createCommentSchema);
  const comment = await createItemComment(id, c.var.user.id, input);
  return apiSuccess(c, comment, 'Comment added', 201);
};

export const patchComment = async (c: Context) => {
  const id = idParam(c, 'id');
  const input = await parseBody(c, updateCommentSchema);
  return apiSuccess(
    c,
    await updateComment(id, c.var.user.id, input),
    'Comment updated',
  );
};

export const deleteCommentById = async (c: Context) => {
  await deleteComment(idParam(c, 'id'), c.var.user.id);
  return apiSuccess(c, null, 'Comment deleted');
};

export const getDocumentComments = async (c: Context) =>
  apiSuccess(c, await listDocumentComments(idParam(c, 'id'), c.var.user.id));

export const postDocumentComment = async (c: Context) => {
  const id = idParam(c, 'id');
  const input = await parseBody(c, createCommentSchema);
  const comment = await createDocumentComment(id, c.var.user.id, input);
  return apiSuccess(c, comment, 'Comment added', 201);
};
