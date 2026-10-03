import { Hono } from 'hono';
import { health } from './routes/health.js';

/** Builds the API. Routes live under `/api`, which the web app proxies. */
export function createApp() {
  const app = new Hono();
  app.route('/health', health);

  const api = new Hono();
  api.route('/health', health);
  app.route('/api', api);

  return app;
}
