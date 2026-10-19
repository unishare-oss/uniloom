import { HTTPException } from 'hono/http-exception';
import { UNIAUTH_PROVIDER_ID } from '@/auth/constants.js';
import { Role } from '@/generated/prisma/enums.js';
import { apiError } from '@/http.js';
import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';
import {
  directoryEnabled,
  resolveIdentity,
} from '@/modules/uniauth/directory.client.js';
import { ensureLocalUser } from '@/modules/uniauth/uniauth.service.js';
import * as memberRepo from './member.repository.js';
import { takeLookup } from './member.rate-limit.js';
import { view } from './member.utils.js';

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
  db: Prisma.TransactionClient = prisma,
) => {
  const member = await memberRepo.findMember(projectId, userId, db);
  if (!member) throw apiError(404, 'not_found', 'Project not found');
  if (!roles.includes(member.role))
    throw apiError(403, 'forbidden', 'Your role cannot do this');
  return member;
};

/** Every member, owners first. Any member may ask. */
export const listMembers = async (projectId: string, userId: string) => {
  await requireRole(projectId, userId, ROLES);
  const members = await memberRepo.findMembers(projectId);
  const owners = members.filter((m) => m.role === 'OWNER');
  const others = members.filter((m) => m.role !== 'OWNER');
  return [...owners, ...others].map(view);
};

/** True for the 503 the directory client throws when uniAuth cannot answer. */
const isUnavailable = (error: unknown) => {
  return error instanceof HTTPException && error.status === 503;
};

/** A user created by a uniAuth sign-in (or provisioning) has an account row for it. */
const hasUniauthLink = async (userId: string) => {
  return (
    (await prisma.account.count({
      where: { userId, providerId: UNIAUTH_PROVIDER_ID },
    })) > 0
  );
};

/**
 * Owner or manager, who may only add people as Member. The person needs a Unicorp account
 * (uniAuth's directory is asked, so they need not have signed in to Uniloom yet; their local
 * user is created and links to the same account their first sign-in will use). Without
 * directory credentials only people who already signed in to Uniloom are found.
 */
export const addMember = async (
  projectId: string,
  userId: string,
  input: { email: string; role: Role },
) => {
  const caller = await requireRole(projectId, userId, CREATORS);
  if (!assignableRoles(caller.role).includes(input.role))
    throw apiError(403, 'forbidden', 'Your role cannot give that role');
  // Each lookup says whether an email has an account, so each person gets a few per hour.
  if (!takeLookup(userId))
    throw apiError(
      429,
      'rate_limited',
      'Too many lookups. Try again in a little while, or share an invite link.',
    );
  let targetId: string | undefined;
  if (directoryEnabled()) {
    // Asked after the role check, and always: a local copy of the email may be stale.
    try {
      const identity = await resolveIdentity(input.email);
      if (identity) targetId = await ensureLocalUser(identity, true);
    } catch (error) {
      if (!isUnavailable(error)) throw error;
      // uniAuth is down: someone who already has a uniAuth link here can still be added.
      const local = await memberRepo.findUserByEmail(input.email);
      if (!local || !(await hasUniauthLink(local.id))) throw error;
      targetId = local.id;
    }
  } else {
    targetId = (await memberRepo.findUserByEmail(input.email))?.id;
  }
  // The same answer whether there is no account, or it is unverified or suspended.
  if (!targetId)
    throw apiError(
      404,
      'user_not_found',
      'No Unicorp account with that email can be added. Ask them for an invite link instead.',
    );
  const member = await memberRepo.insertMember(projectId, targetId, input.role);
  if (!member)
    throw apiError(409, 'already_member', 'They are already a member');
  // If they had asked to join through an invite link, that request is answered now.
  await memberRepo.settleJoinRequest(prisma, projectId, targetId);
  return view(member);
};

/**
 * Adds `userId` as a Member inside the caller's transaction, for a join through an invite
 * link or an approved request, and settles their waiting request if they had one. No
 * role check: the link or the approval is the permission. Throws P2002 if they already
 * belong.
 */
export const joinAsMember = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
) => {
  await memberRepo.createMember(tx, projectId, userId, 'MEMBER');
  await memberRepo.settleJoinRequest(tx, projectId, userId);
};

/**
 * For an approved join request: adds `userId` as a Member unless they already belong
 * (added by email meanwhile), in which case their role stays as it is.
 */
export const approveAsMember = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
) => {
  await memberRepo.createMemberIfMissing(tx, projectId, userId, 'MEMBER');
  await memberRepo.settleJoinRequest(tx, projectId, userId);
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
  const target = await memberRepo.findMember(projectId, targetId, tx);
  if (!target) throw apiError(404, 'not_found', 'Member not found');
  if (
    target.role === 'OWNER' &&
    newRole !== 'OWNER' &&
    (await memberRepo.countOwners(tx, projectId)) <= 1
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
    await memberRepo.lockProject(tx, projectId);
    await checkKeepsOwner(tx, projectId, targetId, role);
    return memberRepo.updateRole(tx, projectId, targetId, role);
  });
  return view(member);
};

/**
 * An owner removes anyone; anyone removes themselves (leaves). Their tickets become
 * unassigned, so others can claim them.
 */
export const removeMember = async (
  projectId: string,
  userId: string,
  targetId: string,
) => {
  await requireRole(projectId, userId, userId === targetId ? ROLES : ['OWNER']);
  await prisma.$transaction(async (tx) => {
    await memberRepo.lockProject(tx, projectId);
    await checkKeepsOwner(tx, projectId, targetId, null);
    await memberRepo.deleteMember(tx, projectId, targetId);
    await memberRepo.unassignAll(tx, projectId, targetId);
  });
};
