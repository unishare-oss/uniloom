import { createApp } from './app.js';

describe('createApp', () => {
  const app = createApp();

  it.each(['/health', '/api/health'])('GET %s → 200 ok', async (path) => {
    const res = await app.request(path);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('returns 404 for an unknown route', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
  });
});
