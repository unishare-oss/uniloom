import { randomUUID } from 'node:crypto';
import { prisma } from '../src/db.js';

/** Invariants the database enforces on its own (docs/plans/02-workspaces.md). */
describe('database schema (e2e)', () => {
  const workspaceIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  /** A Guided workspace, with the switches its mode preset will set. */
  async function newWorkspace(keyPrefix = `T${randomUUID().slice(0, 8)}`) {
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Schema test',
        keyPrefix,
        mode: 'GUIDED',
        checklistRequired: true,
        designRequired: true,
        approvalRequired: true,
        approverNotAuthor: true,
        plannedVsActual: true,
      },
    });
    workspaceIds.push(workspace.id);
    return workspace;
  }

  async function newUser() {
    const id = randomUUID();
    userIds.push(id);
    return prisma.user.create({
      data: { id, name: 'Mya', email: `${id}@example.com` },
    });
  }

  it('gives a new workspace a UUIDv7 id and starts numbering at 1', async () => {
    const workspace = await newWorkspace();

    expect(workspace.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(workspace.nextItemNumber).toBe(1);
  });

  it('keeps key prefixes unique', async () => {
    const { keyPrefix } = await newWorkspace();

    await expect(newWorkspace(keyPrefix)).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows one membership per person per workspace', async () => {
    const workspace = await newWorkspace();
    const user = await newUser();
    const data = { workspaceId: workspace.id, userId: user.id };
    await prisma.member.create({ data: { ...data, role: 'OWNER' } });

    await expect(
      prisma.member.create({ data: { ...data, role: 'MEMBER' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('removes memberships with their workspace or their person', async () => {
    const workspace = await newWorkspace();
    const other = await newWorkspace();
    const user = await newUser();
    await prisma.member.createMany({
      data: [
        { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
        { workspaceId: other.id, userId: user.id, role: 'MEMBER' },
      ],
    });

    await prisma.workspace.delete({ where: { id: workspace.id } });
    expect(await prisma.member.count({ where: { userId: user.id } })).toBe(1);

    await prisma.user.delete({ where: { id: user.id } });
    expect(
      await prisma.member.count({ where: { workspaceId: other.id } }),
    ).toBe(0);
  });
});
