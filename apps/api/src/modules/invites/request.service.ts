import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import {
  CREATORS,
  joinAsMember,
  requireRole,
} from '@/modules/members/member.service.js';
import { lockProject } from './invite.repository.js';
import * as requestRepo from './request.repository.js';

/** Owner or manager. The people waiting to be let in, oldest first. */
export const listJoinRequests = async (projectId: string, userId: string) => {
  await requireRole(projectId, userId, CREATORS);
  const requests = await requestRepo.findWaiting(projectId);
  return requests.map((request) => ({
    id: request.id,
    userId: request.userId,
    name: request.user.name,
    email: request.user.email,
    image: request.user.image,
    requestedAt: request.requestedAt,
  }));
};

/**
 * Owner or manager. Approving adds the person as a Member in the same transaction;
 * it works after the link is replaced, deleted or expired, since requests outlive their
 * link. Returns the person's name. 409 `already_decided` if it no longer waits.
 */
export const decideJoinRequest = async (
  projectId: string,
  userId: string,
  requestId: string,
  approve: boolean,
) => {
  await requireRole(projectId, userId, CREATORS);
  return prisma.$transaction(async (tx) => {
    // Locked, so an owner and a manager deciding at once can't both pass the check.
    await lockProject(tx, projectId);
    const request = await requestRepo.findById(tx, requestId);
    if (!request || request.projectId !== projectId)
      throw apiError(404, 'not_found', 'Join request not found');
    const decided =
      request.status === 'PENDING' &&
      (await requestRepo.decideIfPending(
        tx,
        requestId,
        approve ? 'APPROVED' : 'DECLINED',
        userId,
      ));
    if (!decided)
      throw apiError(
        409,
        'already_decided',
        'This request is no longer pending',
      );
    if (approve) await joinAsMember(tx, projectId, request.userId);
    return request.user.name;
  });
};

/**
 * The caller's own waiting requests. Only the project's name and key go out: the same
 * that the invite link already showed them, and nothing else about a project they
 * aren't in.
 */
export const listMyJoinRequests = async (userId: string) => {
  const requests = await requestRepo.findMineWaiting(userId);
  return requests.map((request) => ({
    id: request.id,
    projectName: request.project.name,
    keyPrefix: request.project.keyPrefix,
    requestedAt: request.requestedAt,
  }));
};

/**
 * The caller takes their own request back. The slot it used stays used, and they may
 * ask again through the same link (ADR-0014). 404 if it isn't theirs, 409
 * `already_decided` if it no longer waits.
 */
export const cancelJoinRequest = async (userId: string, requestId: string) => {
  const request = await requestRepo.findOwn(requestId, userId);
  if (!request) throw apiError(404, 'not_found', 'Join request not found');
  if (
    request.status !== 'PENDING' ||
    !(await requestRepo.cancelIfPending(requestId, userId))
  )
    throw apiError(409, 'already_decided', 'This request is no longer pending');
};
