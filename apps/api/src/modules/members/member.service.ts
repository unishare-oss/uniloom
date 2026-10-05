import type { Role } from '@/generated/prisma/enums.js';
import { apiError } from '@/http.js';
import {
  deleteKeepingOwner,
  findMember,
  findMembers,
  findUserByEmail,
  insertMember,
  updateRoleKeepingOwner,
} from './member.repository.js';

const ALL_ROLES: Role[] = ['OWNER', 'REVIEWER', 'MEMBER'];

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
  await requireRole(projectId, userId, ALL_ROLES);
  const members = await findMembers(projectId);
  const owners = members.filter((m) => m.role === 'OWNER');
  const others = members.filter((m) => m.role !== 'OWNER');
  return [...owners, ...others].map(view);
};

/** Owner only. The person must already have a Uniloom account. */
export const addMember = async (
  projectId: string,
  userId: string,
  input: { email: string; role: Role },
) => {
  await requireRole(projectId, userId, ['OWNER']);
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

/** Owner only. The last owner can't be demoted. */
export const changeRole = async (
  projectId: string,
  userId: string,
  targetId: string,
  role: Role,
) => {
  await requireRole(projectId, userId, ['OWNER']);
  return view(await updateRoleKeepingOwner(projectId, targetId, role));
};

/** An owner removes anyone; anyone removes themselves (leaves). */
export const removeMember = async (
  projectId: string,
  userId: string,
  targetId: string,
) => {
  await requireRole(
    projectId,
    userId,
    userId === targetId ? ALL_ROLES : ['OWNER'],
  );
  await deleteKeepingOwner(projectId, targetId);
};
