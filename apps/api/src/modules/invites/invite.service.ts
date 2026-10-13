import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import { apiError } from '@/http.js';
import {
  CREATORS,
  joinAsMember,
  requireRole,
} from '@/modules/members/member.service.js';
import { isProjectMember } from '@/modules/projects/project.service.js';
import * as inviteRepo from './invite.repository.js';
import { linkState } from './invite.rules.js';
import { EXPIRY_SECONDS } from './invite.schema.js';
import type { LinkState } from './invite.types.js';
import { newToken, view } from './invite.utils.js';

/** The answer for a link that lets nobody in. None of them names the project. */
const deadLinkError = (state: Exclude<LinkState, 'live'>) => {
  if (state === 'expired')
    return apiError(410, 'invite_expired', 'This invite link has expired');
  if (state === 'full')
    return apiError(409, 'invite_full', 'This invite link is full');
  return apiError(404, 'invite_not_found', "This invite link doesn't work");
};

/**
 * Owner or manager. Makes the project's link, and the one before it stops working in
 * the same transaction: a project has one live link (ADR-0014).
 */
export const createInvite = async (
  projectId: string,
  userId: string,
  input: { expiresIn: keyof typeof EXPIRY_SECONDS; maxUses: number | null },
) => {
  await requireRole(projectId, userId, CREATORS);
  const now = new Date();
  const invite = await prisma.$transaction(async (tx) => {
    // Locked, so two people creating at once end with one live link.
    await inviteRepo.lockProject(tx, projectId);
    await inviteRepo.revokeCurrent(tx, projectId, now);
    return inviteRepo.insertInvite(tx, {
      projectId,
      token: newToken(),
      maxUses: input.maxUses,
      expiresAt: new Date(
        now.getTime() + EXPIRY_SECONDS[input.expiresIn] * 1000,
      ),
      createdById: userId,
    });
  });
  return view(invite, now);
};

/** Owner or manager. The current link, also when expired or full; null if there is none. */
export const getInvite = async (projectId: string, userId: string) => {
  await requireRole(projectId, userId, CREATORS);
  const invite = await inviteRepo.findCurrent(projectId);
  return invite ? view(invite, new Date()) : null;
};

/** Owner or manager. The link stops working at once; with no link, nothing happens. */
export const deleteInvite = async (projectId: string, userId: string) => {
  await requireRole(projectId, userId, CREATORS);
  await inviteRepo.revokeCurrent(prisma, projectId, new Date());
};

/**
 * What the holder of a link sees before joining. A member gets the project even through
 * a dead link, so an old link in a chat still takes them there.
 */
export const previewInvite = async (token: string, userId: string) => {
  const invite = await inviteRepo.findByToken(token);
  if (!invite) throw deadLinkError('revoked');
  const isMember = await isProjectMember(invite.projectId, userId);
  const state = linkState(invite, new Date());
  if (!isMember && state !== 'live') throw deadLinkError(state);
  return {
    projectId: invite.projectId,
    projectName: invite.project.name,
    invitedBy: invite.createdBy?.name ?? null,
    isMember,
  };
};

/**
 * Adds the caller to the link's project as a Member and uses one slot. Someone already
 * in the project gets it back and uses none.
 */
export const joinByInvite = async (token: string, userId: string) => {
  const invite = await inviteRepo.findByToken(token);
  if (!invite) throw deadLinkError('revoked');
  const joined = { result: 'joined' as const, projectId: invite.projectId };
  if (await isProjectMember(invite.projectId, userId))
    return { ...joined, projectName: invite.project.name };

  const now = new Date();
  const tookSlot = await prisma
    .$transaction(async (tx) => {
      if (!(await inviteRepo.takeSlot(tx, invite.id, now))) return false;
      await joinAsMember(tx, invite.projectId, userId);
      return true;
    })
    .catch((error: unknown) => {
      // They joined in another request meanwhile; the rollback gave the slot back.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return true;
      throw error;
    });
  if (!tookSlot) {
    // Read again: the link may have filled up or been replaced since the first read.
    const current = await inviteRepo.findByToken(token);
    const state = current ? linkState(current, new Date()) : 'revoked';
    throw deadLinkError(state === 'live' ? 'full' : state);
  }
  return { ...joined, projectName: invite.project.name };
};
