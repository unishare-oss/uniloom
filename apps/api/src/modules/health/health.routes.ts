import { Hono } from 'hono';

/** Liveness check for the cluster and the web proxy. */
export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => c.text('ok'));
