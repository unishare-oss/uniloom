import { z, type ZodType, type ZodObject } from 'zod';
import {
  describeRoute,
  resolver,
  type GenerateSpecOptions,
  type DescribeRouteOptions,
} from 'hono-openapi';

type ParameterSchema = Extract<
  NonNullable<DescribeRouteOptions['parameters']>[number],
  { in: string }
>['schema'];

/**
 * Describes a route for the OpenAPI spec, which the web app turns into typed hooks
 * (Orval). `data` is the shape inside the answer's `{ success, message, data }`, as in
 * Unishare: the web fetcher unwraps it.
 */
export const describe = (route: {
  tag: string;
  /** Becomes the hook's name in the web app: getMe → useGetMe. */
  operationId: string;
  summary: string;
  pathParams?: string[];
  body?: ZodType;
  query?: ZodObject;
  data: ZodType;
  status?: 200 | 201;
}) => {
  return describeRoute({
    tags: [route.tag],
    operationId: route.operationId,
    summary: route.summary,
    parameters: [
      ...(route.pathParams ?? []).map((name) => ({
        name,
        in: 'path' as const,
        required: true,
        schema: { type: 'string' as const, format: 'uuid' },
      })),
      ...Object.entries(route.query?.shape ?? {}).map(([name, schema]) => ({
        name,
        in: 'query' as const,
        required: !schema.isOptional(),
        schema: z.toJSONSchema(schema) as ParameterSchema,
      })),
    ],
    ...(route.body && {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: resolver(route.body) } },
      },
    }),
    responses: {
      [route.status ?? 200]: {
        description: route.summary,
        content: { 'application/json': { schema: resolver(route.data) } },
      },
    },
  });
};

/** Spec settings, shared by GET /api/openapi.json and `bun run api:spec`. */
export const specOptions: Partial<GenerateSpecOptions> = {
  documentation: {
    openapi: '3.1.0',
    info: {
      title: 'Uniloom API',
      version: '0.1.0',
      description:
        'Every answer is `{ success: true, message, data }` (the schemas below show `data`) ' +
        'or `{ success: false, statusCode, code, message }` with a stable `code`.',
    },
    servers: [{ url: '/' }],
  },
  // Sign-in (Better Auth's own client), uniAuth's server-to-server calls, health and the
  // docs themselves are not part of the web app's API.
  exclude: [
    /^\/api\/auth\//,
    /^\/api\/uniauth\//,
    /health$/,
    /^\/api\/openapi\.json$/,
    /^\/api\/docs$/,
  ],
};
