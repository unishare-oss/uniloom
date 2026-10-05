import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

/**
 * An error the API answers with, as `{ success: false, statusCode, code, message }`. Throw it
 * from a service, handler or middleware; Hono returns its response.
 */
export const apiError = (
  status: ContentfulStatusCode,
  code: string,
  message: string,
) => {
  return new HTTPException(status, {
    res: Response.json(
      { success: false, statusCode: status, code, message },
      { status },
    ),
  });
};

/** A successful answer: `{ success: true, message, data }`. */
export const apiSuccess = (
  c: Context,
  data: unknown,
  message = 'OK',
  status: ContentfulStatusCode = 200,
) => {
  return c.json({ success: true, message, data }, status);
};

/** The JSON body, checked against `schema`, or a 400 `invalid_input`. */
export const parseBody = async <T extends z.ZodType>(c: Context, schema: T) => {
  const result = schema.safeParse(await c.req.json().catch(() => undefined));
  if (!result.success)
    throw apiError(400, 'invalid_input', z.prettifyError(result.error));
  return result.data;
};

/** A path parameter that must be a uuid; anything else can't exist, so 404. */
export const idParam = (c: Context, name: string) => {
  const value = c.req.param(name);
  if (!value || !z.uuid().safeParse(value).success)
    throw apiError(404, 'not_found', 'Not found');
  return value;
};
