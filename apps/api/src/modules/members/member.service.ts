import { Role } from '@/generated/prisma/enums.js';
import { apiError } from '@/http.js';
import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';
import {
  countOwners,
  deleteMember,
  findMember,
  findMembers,
  findUserByEmail,
  insertMember,
  lockProject,
  updateRole,
} from './member.repository.js';

/** Every role. */
export const ROLES: Role[] = Object.values(Role);

/** The roles that create, delete and restore work. */
export const CREATORS: Role[] = ['OWNER', 'MANAGER'];

/** The roles `role` may give when adding a member: owners any, managers only Member. */
export const assignableRoles = (role: Role): Role[] => {
  if (role === 'OWNER') return ROLES;
  if (role === 'MANAGER') return ['MEMBER'];
  return [];
};

/**
 * The caller's membership. 404 if they aren't a member (so ids reveal nothing), 403
 * `forbidden` if their role isn't in `roles`. Every role-restricted action calls this.
 */
export const requireRole = async (
  projectId: string,
  userId: string,
  roles: Role[],
) => {
  const member = await findMember(projectId, userId);
  if (!member) throw apiError(404, 'not_found', 'Project not found');
  if (!roles.includes(member.role))
    throw apiError(403, 'forbidden', 'Your role cannot do this');
  return member;
};

const view = (member: {
  userId: string;
  role: Role;
  createdAt: Date;
  user: { name: string; email: string; image: string | null };
}) => ({
  userId: member.userId,
  name: member.user.name,
  email: member.user.email,
  image: member.user.image,
  role: member.role,
  createdAt: member.createdAt,
});

/** Every member, owners first. Any member may ask. */
export const listMembers = async (projectId: string, userId: string) => {
  await requireRole(projectId, userId, ROLES);
  const members = await findMembers(projectId);
  const owners = members.filter((m) => m.role === 'OWNER');
  const others = members.filter((m) => m.role !== 'OWNER');
  return [...owners, ...others].map(view);
};

/**
 * Owner or manager, who may only add people as Member. The person must already have a
 * Uniloom account.
 */
export const addMember = async (
  projectId: string,
  userId: string,
  input: { email: string; role: Role },
) => {
  const caller = await requireRole(projectId, userId, CREATORS);
  if (!assignableRoles(caller.role).includes(input.role))
    throw apiError(403, 'forbidden', 'Your role cannot give that role');
  const user = await findUserByEmail(input.email);
  if (!user)
    throw apiError(
      404,
      'user_not_found',
      'No Uniloom account has that email yet',
    );
  const member = await insertMember(projectId, user.id, input.role);
  if (!member)
    throw apiError(409, 'already_member', 'They are already a member');
  return view(member);
};

/**
 * 404 if the target isn't a member, 409 `last_owner` if changing them to `newRole` (or
 * removing them, when null) would leave no owner. Call it with the project locked.
 */
const checkKeepsOwner = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  targetId: string,
  newRole: Role | null,
) => {
  const target = await findMember(projectId, targetId, tx);
  if (!target) throw apiError(404, 'not_found', 'Member not found');
  if (
    target.role === 'OWNER' &&
    newRole !== 'OWNER' &&
    (await countOwners(tx, projectId)) <= 1
  )
    throw apiError(
      409,
      'last_owner',
      'A project needs at least one owner. Make another member an owner first.',
    );
};

/** Owner only. The last owner can't be demoted. */
export const changeRole = async (
  projectId: string,
  userId: string,
  targetId: string,
  role: Role,
) => {
  await requireRole(projectId, userId, ['OWNER']);
  // Locked, so two owners demoting each other at once can't both pass.
  const member = await prisma.$transaction(async (tx) => {
    await lockProject(tx, projectId);
    await checkKeepsOwner(tx, projectId, targetId, role);
    return updateRole(tx, projectId, targetId, role);
  });
  return view(member);
};

/** An owner removes anyone; anyone removes themselves (leaves). */
export const removeMember = async (
  projectId: string,
  userId: string,
  targetId: string,
) => {
  await requireRole(projectId, userId, userId === targetId ? ROLES : ['OWNER']);
  await prisma.$transaction(async (tx) => {
    await lockProject(tx, projectId);
    await checkKeepsOwner(tx, projectId, targetId, null);
    await deleteMember(tx, projectId, targetId);
  });
};
