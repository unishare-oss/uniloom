import { Hono } from 'hono';

/** Liveness check for the cluster and the web proxy. */
export const health = new Hono().get('/', (c) => c.text('ok'));
