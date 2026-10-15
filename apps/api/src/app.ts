import '@/telemetry.js';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { openAPIRouteHandler } from 'hono-openapi';
import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@/generated/prisma/client.js';
import { apiError } from '@/http.js';
import { healthRoutes } from '@/modules/health/health.routes.js';
import { mcpRoutes } from '@/modules/mcp/mcp.routes.js';
import { specOptions } from '@/openapi.js';
import { apiRoutes } from '@/routes/index.js';

/** The API. Everything under /api except health is in routes/index.ts. */
export const app = new Hono();
const httpTelemetry = httpInstrumentationMiddleware({
  serviceName: 'uniloom-api',
});
app.use('*', async (c, next) => {
  if (c.req.path === '/health' || c.req.path === '/api/health') return next();
  return httpTelemetry(c, next);
});
app.use('*', async (c, next) => {
  const started = performance.now();
  await next();
  const span = trace.getSpan(context.active())?.spanContext();
  if (span && isSpanContextValid(span))
    console.log(
      JSON.stringify({
        event: 'http.request.completed',
        service: 'uniloom-api',
        method: c.req.method,
        status_code: c.res.status,
        duration_ms: Math.round(performance.now() - started),
        trace_id: span.traceId,
        span_id: span.spanId,
      }),
    );
});

// Health checks, for the cluster and through the web app's /api proxy.
app.route('/health', healthRoutes);
app.route('/api/health', healthRoutes);

// The API's OpenAPI spec and a page to read it. Public: the repository is too.
app.get('/api/openapi.json', openAPIRouteHandler(app, specOptions));
app.get(
  '/api/docs',
  Scalar({ url: '/api/openapi.json', pageTitle: 'Uniloom API' }),
);

app.route('/api', apiRoutes);

// The MCP server and its discovery documents: agents sign in through uniAuth, not a session.
app.route('/', mcpRoutes);

// Every answer keeps the { success: false, statusCode, code, message } shape.
app.notFound(() => apiError(404, 'not_found', 'Not found').getResponse());
app.onError((error) => {
  if (error instanceof HTTPException) return error.getResponse();
  // A unique index refused a duplicate that slipped past a service check.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
    return apiError(409, 'conflict', 'That already exists').getResponse();
  console.error(error);
  return apiError(500, 'internal_error', 'Something went wrong').getResponse();
});
