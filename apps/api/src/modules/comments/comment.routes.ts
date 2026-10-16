import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteCommentById,
  getDocumentComments,
  getItemComments,
  patchComment,
  postDocumentComment,
  postItemComment,
} from './comment.handlers.js';
import {
  commentSchema,
  commentTreeSchema,
  createCommentSchema,
  updateCommentSchema,
} from './comment.schema.js';

/** Comments on tickets and documents: listed and added per ticket, then edited or deleted by id. */
export const commentRoutes = new Hono();

commentRoutes.get(
  '/items/:id/comments',
  describe({
    tag: 'comments',
    operationId: 'listItemComments',
    summary: "A ticket's comments as a tree, oldest first",
    pathParams: ['id'],
    data: commentTreeSchema,
  }),
  getItemComments,
);
commentRoutes.post(
  '/items/:id/comments',
  describe({
    tag: 'comments',
    operationId: 'createItemComment',
    summary: 'Comment on a ticket or reply to a comment (any member)',
    pathParams: ['id'],
    body: createCommentSchema,
    data: commentSchema,
    status: 201,
  }),
  postItemComment,
);
commentRoutes.get(
  '/documents/:id/comments',
  describe({
    tag: 'comments',
    operationId: 'listDocumentComments',
    summary: "A document's comments as a tree, oldest first",
    pathParams: ['id'],
    data: commentTreeSchema,
  }),
  getDocumentComments,
);
commentRoutes.post(
  '/documents/:id/comments',
  describe({
    tag: 'comments',
    operationId: 'createDocumentComment',
    summary: 'Comment on a document or reply to a comment (any member)',
    pathParams: ['id'],
    body: createCommentSchema,
    data: commentSchema,
    status: 201,
  }),
  postDocumentComment,
);
commentRoutes.patch(
  '/comments/:id',
  describe({
    tag: 'comments',
    operationId: 'updateComment',
    summary: 'Edit a comment (its author only)',
    pathParams: ['id'],
    body: updateCommentSchema,
    data: commentSchema,
  }),
  patchComment,
);
commentRoutes.delete(
  '/comments/:id',
  describe({
    tag: 'comments',
    operationId: 'deleteComment',
    summary: 'Delete a comment (author, owner or manager); replies stay',
    pathParams: ['id'],
    data: z.null(),
  }),
  deleteCommentById,
);
