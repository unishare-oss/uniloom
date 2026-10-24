import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import type { Prisma } from '@/generated/prisma/client.js';
import { loadItem } from '@/modules/items/item.service.js';
import { requireRole } from '@/modules/members/member.service.js';
import { retryDelay } from '@/modules/notifications/notification.rules.js';
import { checkResult } from './github.rules.js';
import { findKeys } from './github.utils.js';
import type {
  CheckSuitePayload,
  InstallationPayload,
  PullRequestPayload,
} from './github.types.js';
import * as githubRepo from './github.repository.js';

/** Stores one delivery for the worker. False when the same delivery id was already stored. */
export const receiveDelivery = async (
  id: string,
  event: string,
  payload: Prisma.InputJsonValue,
) => githubRepo.storeDelivery(id, event, payload);

/** `installation` and `installation_repositories`: which installations and repos exist. */
const applyInstallation = async (
  tx: Prisma.TransactionClient,
  payload: InstallationPayload,
) => {
  const { id, account } = payload.installation;
  if (payload.action === 'deleted') {
    await githubRepo.markInstallationDeleted(tx, id);
    return;
  }
  if (payload.action !== 'created' && payload.action !== 'added') return;
  await githubRepo.upsertInstallation(tx, id, account.login);
  const repositories = payload.repositories ?? payload.repositories_added ?? [];
  for (const repository of repositories)
    await githubRepo.upsertRepository(
      tx,
      repository.id,
      id,
      repository.full_name,
    );
};

const applyRepositoriesRemoved = async (
  tx: Prisma.TransactionClient,
  payload: InstallationPayload,
) => {
  const removed = payload.repositories_removed ?? [];
  await githubRepo.markRepositoriesRemoved(
    tx,
    removed.map((repository) => repository.id),
  );
};

/**
 * Links the pull request to the tickets its title, branch and description name, for the keys of
 * the projects the repo is mapped to. Title, branch and closing words close; other mentions don't.
 * Existing links stay.
 */
const linkPullRequest = async (
  tx: Prisma.TransactionClient,
  pullRequestId: string,
  pr: PullRequestPayload['pull_request'],
  projects: { id: string; keyPrefix: string }[],
) => {
  const prefixes = projects.map((project) => project.keyPrefix);
  const named = findKeys(`${pr.title}\n${pr.head.ref}`, prefixes).map(
    (found) => ({ ...found, closes: true }),
  );
  const keys = new Map<string, boolean>();
  for (const found of [...named, ...findKeys(pr.body ?? '', prefixes)])
    keys.set(found.key, (keys.get(found.key) ?? false) || found.closes);
  if (keys.size === 0) return;

  const wanted = [...keys.keys()].map((key) => {
    const [prefix, number] = key.split('-');
    const project = projects.find((p) => p.keyPrefix === prefix)!;
    return { key, projectId: project.id, number: Number(number) };
  });
  const items = await githubRepo.findLiveItems(tx, wanted);
  for (const item of items) {
    const key = wanted.find(
      (w) => w.projectId === item.projectId && w.number === item.number,
    )!.key;
    await githubRepo.upsertPullRequestItem(
      tx,
      pullRequestId,
      item.id,
      keys.get(key) ?? false,
    );
  }
};

/** `pull_request`: store the newest state of a pull request in a mapped repo and link its tickets. */
const applyPullRequest = async (
  tx: Prisma.TransactionClient,
  payload: PullRequestPayload,
) => {
  const repository = await githubRepo.findLiveMappedRepository(
    tx,
    payload.repository.id,
  );
  const projects = repository?.projects.map((row) => row.project) ?? [];
  if (projects.length === 0) return;

  const pr = payload.pull_request;
  const updatedAt = new Date(pr.updated_at);
  const stored = await githubRepo.findPullRequest(
    tx,
    payload.repository.id,
    pr.number,
  );
  if (stored && stored.githubUpdatedAt > updatedAt) return;

  const saved = await githubRepo.upsertPullRequest(
    tx,
    payload.repository.id,
    pr.number,
    {
      title: pr.title,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      state: pr.merged ? 'MERGED' : pr.state === 'closed' ? 'CLOSED' : 'OPEN',
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      mergedByLogin: pr.merged_by?.login ?? null,
      authorLogin: pr.user.login,
      url: pr.html_url,
      githubUpdatedAt: updatedAt,
    },
  );
  await linkPullRequest(tx, saved.id, pr, projects);
};

/** `check_suite`: keep the suite's latest status by commit, matched to pull requests when listed. */
const applyCheckSuite = async (
  tx: Prisma.TransactionClient,
  payload: CheckSuitePayload,
) => {
  if (!(await githubRepo.findRepositoryId(tx, payload.repository.id))) return;
  const suite = payload.check_suite;
  const stored = await githubRepo.findCheckSuite(tx, suite.id);
  // A late "requested" must not undo a finished suite; a re-run ("rerequested") reuses the
  // suite id and starts it again.
  if (
    stored?.status === 'completed' &&
    suite.status !== 'completed' &&
    payload.action !== 'rerequested'
  )
    return;
  await githubRepo.upsertCheckSuite(tx, suite.id, {
    repositoryId: payload.repository.id,
    headSha: suite.head_sha,
    appName: suite.app?.name ?? '',
    status: suite.status,
    conclusion: suite.conclusion,
  });
};

const applyDelivery = async (
  tx: Prisma.TransactionClient,
  event: string,
  payload: unknown,
) => {
  if (event === 'installation')
    return applyInstallation(tx, payload as InstallationPayload);
  if (event === 'installation_repositories') {
    await applyInstallation(tx, payload as InstallationPayload);
    return applyRepositoriesRemoved(tx, payload as InstallationPayload);
  }
  if (event === 'pull_request')
    return applyPullRequest(tx, payload as PullRequestPayload);
  if (event === 'check_suite')
    return applyCheckSuite(tx, payload as CheckSuitePayload);
};

/** Applies one due delivery and marks it processed in the same transaction. False when none is due. */
export const processNextGithubDelivery = async () => {
  let deliveryId: string | null = null;
  try {
    return await prisma.$transaction(async (tx) => {
      const delivery = await githubRepo.findNextDueDelivery(tx);
      if (!delivery) return false;
      deliveryId = delivery.id;
      await applyDelivery(tx, delivery.event, delivery.payload);
      await githubRepo.markDeliveryProcessed(tx, delivery.id);
      return true;
    });
  } catch (error) {
    if (deliveryId) await recordDeliveryFailure(deliveryId);
    throw error;
  }
};

const recordDeliveryFailure = async (id: string) => {
  await prisma.$transaction(async (tx) => {
    const delivery = await githubRepo.lockDelivery(tx, id);
    if (!delivery || delivery.processedAt || delivery.failedAt) return;
    const attempts = delivery.attempts + 1;
    await githubRepo.updateDelivery(tx, id, {
      attempts,
      nextAttemptAt: new Date(Date.now() + retryDelay(attempts)),
      failedAt: attempts >= 10 ? new Date() : null,
      lastError: 'GitHub delivery processing failed; retry after recovery',
    });
    console.error('GitHub delivery processing failed', { id, attempts });
  });
};

/** Operator-only command (`github:retry`): failed deliveries go back in the queue. */
export const retryFailedGithubDeliveries = () =>
  githubRepo.requeueFailedDeliveries();

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
    checks: checkResult(
      suites.filter(
        (suite) =>
          suite.repositoryId === pr.repositoryId &&
          suite.headSha === pr.headSha,
      ),
    ),
    closes,
  }));
};

/** The Owner's view of the repos the App can see, and where to install it. */
export const listProjectRepositories = async (
  projectId: string,
  userId: string,
) => {
  await requireRole(projectId, userId, ['OWNER']);
  const slug = process.env.GITHUB_APP_SLUG;
  const repositories = await githubRepo.findProjectRepositories(projectId);
  return {
    installUrl: slug
      ? `https://github.com/apps/${slug}/installations/new?state=${projectId}`
      : null,
    repositories: repositories.map((repository) => ({
      id: String(repository.id),
      fullName: repository.fullName,
      mapped: repository.projects.length > 0,
    })),
  };
};

const loadLiveRepository = async (repositoryId: bigint) => {
  const repository = await githubRepo.findLiveRepository(repositoryId);
  if (!repository) throw apiError(404, 'not_found', 'Repository not found');
  return repository;
};

/** Owner only: PRs of this repo link to the project's tickets from now on. */
export const mapRepository = async (
  projectId: string,
  userId: string,
  repositoryId: bigint,
) => {
  await requireRole(projectId, userId, ['OWNER']);
  const repository = await loadLiveRepository(repositoryId);
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
  await loadLiveRepository(repositoryId);
  await githubRepo.unmapRepository(projectId, repositoryId);
};
