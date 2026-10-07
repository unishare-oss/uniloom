import type { Context } from 'hono';
import { apiSuccess, apiError } from '@/http.js';
import { reviewQuerySchema } from './review.schema.js';
import { listReviewItems } from './review.service.js';

export const getReviews = async (c: Context) => {
  const parsed = reviewQuerySchema.safeParse(c.req.query());
  if (!parsed.success)
    throw apiError(400, 'invalid_input', 'Invalid review query');
  return apiSuccess(c, await listReviewItems(c.var.user.id, parsed.data));
};
