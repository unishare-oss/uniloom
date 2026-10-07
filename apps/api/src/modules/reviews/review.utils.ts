import { z } from 'zod';
import { apiError } from '@/http.js';

const cursorSchema = z.object({ at: z.iso.datetime(), id: z.uuid() });
export const decodeReviewCursor = (cursor?: string) => {
  if (!cursor) return null;
  try {
    const value = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    return { at: new Date(value.at), id: value.id };
  } catch {
    throw apiError(400, 'invalid_input', 'Invalid pagination cursor');
  }
};
export const reviewCursor = (at: Date, id: string) =>
  Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString(
    'base64url',
  );
