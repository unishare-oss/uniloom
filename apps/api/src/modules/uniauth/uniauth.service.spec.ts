import { ensureLocalUser } from './uniauth.service.js';
import * as repo from './uniauth.repository.js';

vi.mock('./uniauth.repository.js', () => ({
  findUserIdBySub: vi.fn(),
  createLinkedUser: vi.fn(),
}));

it('reports a real identity conflict after one insert and one winner lookup, without polling', async () => {
  vi.mocked(repo.findUserIdBySub).mockResolvedValue(undefined);
  vi.mocked(repo.createLinkedUser).mockResolvedValue({ conflict: 'email' });
  await expect(
    ensureLocalUser({
      id: 'central-sub',
      name: 'Person',
      email: 'person@example.com',
      emailVerified: true,
      image: null,
      status: 'active',
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(repo.createLinkedUser).toHaveBeenCalledTimes(1);
  expect(repo.findUserIdBySub).toHaveBeenCalledTimes(2);
});
