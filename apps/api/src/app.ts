import { Hono } from 'hono';
import { healthRoutes } from '@/modules/health/health.routes.js';
import { apiRoutes } from '@/routes/index.js';

/** The API. Everything under /api except health is in routes/index.ts. */
export const app = new Hono();

// Health checks, for the cluster and through the web app's /api proxy.
app.route('/health', healthRoutes);
app.route('/api/health', healthRoutes);

app.route('/api', apiRoutes);
