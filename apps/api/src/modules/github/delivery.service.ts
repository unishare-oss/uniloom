import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';
import {
  moveItemBySystem,
  recordDoneSkipped,
} from '@/modules/items/item.service.js';
import { checklistError } from '@/modules/items/item.rules.js';
import { retryDelay } from '@/modules/notifications/notification.rules.js';
import {
  checksFor,
  doneBlockers,
  mergedIntoRelease,
  RELEASE_BRANCHES,
} from './github.rules.js';
import { branchKey, findKeys, prState } from './github.utils.js';
import type {
  CheckSuitePayload,
  InstallationPayload,
  PullRequestPayload,
} from './github.types.js';
import * as githubRepo from './github.repository.js';

// The worker side of the GitHub integration: stored deliveries are applied here, in the order
// below. Nothing in this file is called by a handler.

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

/** Operator-only command (`github:retry`): failed deliveries go back in the queue. */
export const retryFailedGithubDeliveries = () =>
  githubRepo.requeueFailedDeliveries();

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

  const state = prState(pr);
  const saved = await githubRepo.upsertPullRequest(
    tx,
    payload.repository.id,
    pr.number,
    {
      title: pr.title,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      state,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      mergedByLogin: pr.merged_by?.login ?? null,
      authorLogin: pr.user.login,
      url: pr.html_url,
      githubUpdatedAt: updatedAt,
    },
  );
  await linkPullRequest(tx, saved.id, pr, projects);
  if (mergedIntoRelease({ state, baseRef: pr.base.ref }))
    await evaluateDone(tx, saved.id, false);
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
  if (suite.status !== 'completed') return;
  const merged = await githubRepo.findMergedPullRequestIds(
    tx,
    payload.repository.id,
    suite.head_sha,
    RELEASE_BRANCHES,
  );
  for (const id of merged) await evaluateDone(tx, id, true);
};

/**
 * For each ticket this pull request closes, in a project with "Move to Done when merged":
 * moves it from In Review to Done when everything holds, writes one `github.done_skipped`
 * row when something a person must fix stops it, and writes nothing while it only waits.
 */
const evaluateDone = async (
  tx: Prisma.TransactionClient,
  pullRequestId: string,
  checksAfterMerge: boolean,
) => {
  const candidates = await githubRepo.findDoneCandidates(tx, pullRequestId);
  for (const { item } of candidates) {
    // Done or Canceled by a person already: this link is spent.
    if (['DONE', 'CANCELED'].includes(item.state.category)) {
      await githubRepo.settleLinks(tx, item.id, [pullRequestId]);
      continue;
    }
    const links = await githubRepo.findClosingPullRequests(tx, item.id);
    const suites = await githubRepo.findCheckSuites(
      links.map(({ pullRequest }) => ({
        repositoryId: pullRequest.repositoryId,
        headSha: pullRequest.headSha,
      })),
      tx,
    );
    const pullRequests = links.map(({ pullRequest: pr }) => ({
      ...pr,
      checks: checksFor(pr, suites),
    }));
    const done = await githubRepo.findFirstDoneState(tx, item.projectId);
    const blockers = doneBlockers(
      item.state.key,
      pullRequests,
      checklistError(
        item.project,
        item.kind,
        await githubRepo.findChecklist(tx, item.id),
        { key: null, category: 'DONE' },
      ),
      await githubRepo.findOpenBlockerKeys(tx, item.id),
    );
    const merged = links.filter(({ pullRequest }) =>
      mergedIntoRelease(pullRequest),
    );
    const lines = merged.map(({ pullRequest: pr }) => ({
      number: pr.number,
      url: pr.url,
      base: pr.baseRef,
      mergedBy: pr.mergedByLogin,
    }));
    if (blockers.length === 0 && done) {
      const moved = await moveItemBySystem(tx, item.id, done.id, {
        pullRequests: lines,
        checksAfterMerge,
      });
      if (!moved) continue;
      // Settle every link of a merged branch, so the other PR from that branch (dev and main)
      // can't move the ticket again after a person moves it back.
      const branches = merged.map(({ pullRequest }) => branchKey(pullRequest));
      await githubRepo.settleLinks(
        tx,
        item.id,
        links
          .filter(({ pullRequest }) =>
            branches.includes(branchKey(pullRequest)),
          )
          .map((link) => link.pullRequestId),
      );
    } else if (blockers.some((blocker) => !blocker.waiting))
      await recordDoneSkipped(
        tx,
        item.projectId,
        item.id,
        lines,
        blockers.map((blocker) => blocker.reason),
      );
  }
};
