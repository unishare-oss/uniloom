import { Hono } from 'hono';
import { describe } from '@/openapi.js';
import { getReviews } from './review.handlers.js';
import { reviewPageSchema, reviewQuerySchema } from './review.schema.js';

export const reviewRoutes = new Hono();
reviewRoutes.get(
  '/reviews',
  describe({
    tag: 'Reviews',
    operationId: 'getReviews',
    summary: 'Current review work for project owners and managers',
    query: reviewQuerySchema,
    data: reviewPageSchema,
  }),
  getReviews,
);
