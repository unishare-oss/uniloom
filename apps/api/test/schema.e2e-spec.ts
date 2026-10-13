import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';

/** Invariants the database enforces on its own (docs/archived/02-workspaces.md). */
describe('database schema (e2e)', () => {
  const projectIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  /** A Guided project, with the switches its mode preset will set. */
  const newProject = async (keyPrefix = `T${randomUUID().slice(0, 8)}`) => {
    const project = await prisma.project.create({
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
    projectIds.push(project.id);
    return project;
  };

  const newUser = async () => {
    const id = randomUUID();
    userIds.push(id);
    return prisma.user.create({
      data: { id, name: 'Mya', email: `${id}@example.com` },
    });
  };

  it('gives a new project a UUIDv7 id and starts numbering at 1', async () => {
    const project = await newProject();

    expect(project.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(project.nextItemNumber).toBe(1);
  });

  it('keeps key prefixes unique', async () => {
    const { keyPrefix } = await newProject();

    await expect(newProject(keyPrefix)).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows one membership per person per project', async () => {
    const project = await newProject();
    const user = await newUser();
    const data = { projectId: project.id, userId: user.id };
    await prisma.member.create({ data: { ...data, role: 'OWNER' } });

    await expect(
      prisma.member.create({ data: { ...data, role: 'MEMBER' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('removes memberships with their project or their person', async () => {
    const project = await newProject();
    const other = await newProject();
    const user = await newUser();
    await prisma.member.createMany({
      data: [
        { projectId: project.id, userId: user.id, role: 'OWNER' },
        { projectId: other.id, userId: user.id, role: 'MEMBER' },
      ],
    });

    await prisma.project.delete({ where: { id: project.id } });
    expect(await prisma.member.count({ where: { userId: user.id } })).toBe(1);

    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.member.count({ where: { projectId: other.id } })).toBe(
      0,
    );
  });

  it('allows one live invite link per project, and any number of revoked ones', async () => {
    const project = await newProject();
    const link = (revokedAt: Date | null) =>
      prisma.invite.create({
        data: {
          projectId: project.id,
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 3600_000),
          revokedAt,
        },
      });
    await link(new Date());
    await link(new Date());
    await link(null);

    await expect(link(null)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuses an invite limit below 1', async () => {
    const project = await newProject();
    await expect(
      prisma.invite.create({
        data: {
          projectId: project.id,
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 3600_000),
          maxUses: 0,
        },
      }),
    ).rejects.toThrow(/invite_max_uses/);
  });
});
