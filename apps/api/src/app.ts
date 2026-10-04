import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@/generated/prisma/client.js';
import { apiError } from '@/http.js';
import { healthRoutes } from '@/modules/health/health.routes.js';
import { apiRoutes } from '@/routes/index.js';

/** The API. Everything under /api except health is in routes/index.ts. */
export const app = new Hono();

// Health checks, for the cluster and through the web app's /api proxy.
app.route('/health', healthRoutes);
app.route('/api/health', healthRoutes);

app.route('/api', apiRoutes);

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
