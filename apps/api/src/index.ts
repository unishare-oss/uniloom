import { createApp } from './app.js';

const app = createApp();

export default {
  port: Number(process.env.PORT ?? 3011),
  fetch: app.fetch,
};
