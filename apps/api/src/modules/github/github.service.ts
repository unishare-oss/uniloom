import { apiError } from '@/http.js';
import type { Prisma } from '@/generated/prisma/client.js';
import { loadItem } from '@/modules/items/item.service.js';
import { requireRole } from '@/modules/members/member.service.js';
import { checksFor } from './github.rules.js';
import { installUrl } from './github.utils.js';
import * as githubRepo from './github.repository.js';

// What the GitHub handlers call. The worker side (applying deliveries) is in delivery.service.ts.

/** Stores one delivery for the worker. False when the same delivery id was already stored. */
export const receiveDelivery = async (
  id: string,
  event: string,
  payload: Prisma.InputJsonValue,
) => githubRepo.storeDelivery(id, event, payload);

/** The pull requests that name this ticket, with their check result. Any project member may ask. */
export const listItemPullRequests = async (itemId: string, userId: string) => {
  await loadItem(itemId, userId);
  const rows = await githubRepo.findItemPullRequests(itemId);
  const suites = await githubRepo.findCheckSuites(
    rows.map((row) => ({
      repositoryId: row.pullRequest.repositoryId,
      headSha: row.pullRequest.headSha,
    })),
  );
  return rows.map(({ closes, pullRequest: pr }) => ({
    number: pr.number,
    title: pr.title,
    url: pr.url,
    repository: pr.repository.fullName,
    state: pr.state,
    headRef: pr.headRef,
    baseRef: pr.baseRef,
    authorLogin: pr.authorLogin,
    mergedByLogin: pr.mergedByLogin,
    checks: checksFor(pr, suites),
    closes,
  }));
};

/** The Owner's view of the repos the App can see, and where to install it. */
export const listProjectRepositories = async (
  projectId: string,
  userId: string,
) => {
  await requireRole(projectId, userId, ['OWNER']);
  const repositories = await githubRepo.findProjectRepositories(projectId);
  return {
    installUrl: installUrl(process.env.GITHUB_APP_SLUG, projectId),
    repositories: repositories.map((repository) => ({
      id: String(repository.id),
      fullName: repository.fullName,
      mapped: repository.projects.length > 0,
    })),
  };
};

/** Owner only: PRs of this repo link to the project's tickets from now on. */
export const mapRepository = async (
  projectId: string,
  userId: string,
  repositoryId: bigint,
) => {
  await requireRole(projectId, userId, ['OWNER']);
  const repository = await githubRepo.findLiveRepository(repositoryId);
  if (!repository) throw apiError(404, 'not_found', 'Repository not found');
  await githubRepo.mapRepository(projectId, repositoryId);
  return {
    id: String(repository.id),
    fullName: repository.fullName,
    mapped: true,
  };
};

/** Owner only: new events are ignored; links already made stay. */
export const unmapRepository = async (
  projectId: string,
  userId: string,
  repositoryId: bigint,
) => {
  await requireRole(projectId, userId, ['OWNER']);
  if (!(await githubRepo.findLiveRepository(repositoryId)))
    throw apiError(404, 'not_found', 'Repository not found');
  await githubRepo.unmapRepository(projectId, repositoryId);
};
