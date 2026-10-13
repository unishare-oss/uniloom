import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import type { JoinRequestStatus } from '@/generated/prisma/enums.js';
import { apiError } from '@/http.js';
import {
  CREATORS,
  joinAsMember,
  requireRole,
} from '@/modules/members/member.service.js';
import { isProjectMember } from '@/modules/projects/project.service.js';
import * as inviteRepo from './invite.repository.js';
import { linkState } from './invite.rules.js';
import * as requestRepo from './request.repository.js';
import { EXPIRY_SECONDS } from './invite.schema.js';
import type { InviteRow, LinkState } from './invite.types.js';
import { newToken, view } from './invite.utils.js';

/** The answer for a link that lets nobody in. None of them names the project. */
const deadLinkError = (state: Exclude<LinkState, 'live'>) => {
  if (state === 'expired')
    return apiError(410, 'invite_expired', 'This invite link has expired');
  if (state === 'full')
    return apiError(
      409,
      'invite_full',
      'This invite link has reached its limit',
    );
  return apiError(404, 'invite_not_found', "This invite link doesn't work");
};

/**
 * Owner or manager. Makes the project's link, and the one before it stops working in
 * the same transaction: a project has one live link (ADR-0015).
 */
export const createInvite = async (
  projectId: string,
  userId: string,
  input: {
    expiresIn: keyof typeof EXPIRY_SECONDS;
    maxUses: number | null;
    joinApproval: boolean;
  },
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
      joinApproval: input.joinApproval,
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

/** A declined or canceled request through this link: the join page offers "Ask again". */
const againState = (status: JoinRequestStatus | undefined) => {
  return status === 'DECLINED' || status === 'CANCELED' ? status : null;
};

/**
 * What the holder of a link sees before joining. A member gets the project even through
 * a dead link, so an old link in a chat still takes them there; so does someone whose
 * request is waiting, since requests outlive their link. A full link still answers the
 * people who already used one of its slots.
 */
export const previewInvite = async (token: string, userId: string) => {
  const invite = await inviteRepo.findByToken(token);
  if (!invite) throw deadLinkError('revoked');
  const [isMember, pending, mine] = await Promise.all([
    isProjectMember(invite.projectId, userId),
    requestRepo.findPending(prisma, invite.projectId, userId),
    requestRepo.findForInvite(prisma, invite.id, userId),
  ]);
  const state = linkState(invite, new Date());
  const usable = state === 'live' || (state === 'full' && mine !== null);
  if (!isMember && !pending && !usable) throw deadLinkError(state);
  return {
    projectId: invite.projectId,
    projectName: invite.project.name,
    invitedBy: invite.createdBy?.name ?? null,
    isMember,
    joinApproval: invite.joinApproval,
    request: pending ? ('PENDING' as const) : againState(mine?.status),
    requestId: pending?.id ?? null,
  };
};

/**
 * Inside the join transaction, for a link that needs approval. A waiting request in the
 * project is kept as is. Someone who already asked through this link asks again without
 * a new slot, also when the link is full (ADR-0015: one slot per person per link).
 * Anyone else takes a slot first. False when the link no longer lets them ask.
 */
const askToJoin = async (
  tx: Prisma.TransactionClient,
  invite: InviteRow,
  userId: string,
  now: Date,
) => {
  // A replaced or expired link lets nobody ask, whatever requests they already have.
  const state = linkState(invite, now);
  if (state === 'revoked' || state === 'expired') return false;
  if (await requestRepo.findPending(tx, invite.projectId, userId)) return true;
  const mine = await requestRepo.findForInvite(tx, invite.id, userId);
  if (mine) {
    await requestRepo.reopenIfDecided(tx, mine.id, now);
    return true;
  }
  if (!(await inviteRepo.takeSlot(tx, invite.id, now))) return false;
  await requestRepo.insertRequest(tx, {
    projectId: invite.projectId,
    userId,
    inviteId: invite.id,
  });
  return true;
};

/**
 * Through an open link, adds the caller to the project as a Member and uses one slot.
 * Through a link that needs approval, files their request instead. Someone already in
 * the project gets it back and uses no slot.
 */
export const joinByInvite = async (token: string, userId: string) => {
  const invite = await inviteRepo.findByToken(token);
  if (!invite) throw deadLinkError('revoked');
  const answer = {
    projectId: invite.projectId,
    projectName: invite.project.name,
  };
  if (await isProjectMember(invite.projectId, userId))
    return { result: 'joined' as const, ...answer };

  const now = new Date();
  const accepted = await prisma
    .$transaction(async (tx) => {
      if (invite.joinApproval) return askToJoin(tx, invite, userId, now);
      if (!(await inviteRepo.takeSlot(tx, invite.id, now))) return false;
      await joinAsMember(tx, invite.projectId, userId);
      return true;
    })
    .catch((error: unknown) => {
      // The same person got there in another request meanwhile; the rollback gave the
      // slot back.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return true;
      throw error;
    });
  if (!accepted) {
    // Read again: the link may have filled up or been replaced since the first read.
    const current = await inviteRepo.findByToken(token);
    const state = current ? linkState(current, new Date()) : 'revoked';
    throw deadLinkError(state === 'live' ? 'full' : state);
  }
  return {
    result: invite.joinApproval ? ('requested' as const) : ('joined' as const),
    ...answer,
  };
};
