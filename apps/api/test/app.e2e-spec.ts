import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

describe('Uniloom API (e2e)', () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reaches PostgreSQL through Prisma', async () => {
    const [row] = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(row.ok).toBe(1);
  });

  it('serves /api/health without a session', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});
