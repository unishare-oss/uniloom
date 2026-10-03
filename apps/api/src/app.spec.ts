import { app } from './app.js';

describe('app', () => {
  it.each(['/health', '/api/health'])('GET %s → 200 ok', async (path) => {
    const res = await app.request(path);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it.each(['/api/me', '/api/anything'])(
    'GET %s without a session → 401',
    async (path) => {
      expect((await app.request(path)).status).toBe(401);
    },
  );
});
