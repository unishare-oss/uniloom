import { prisma } from '@/db/prisma.js';
import type { Prisma } from '@/generated/prisma/client.js';
import type { PullRequestData } from './github.types.js';

/** One atomic insert; a delivery id already stored is skipped, so the same delivery is kept once. */
export const storeDelivery = async (
  id: string,
  event: string,
  payload: Prisma.InputJsonValue,
) => {
  const { count } = await prisma.githubDelivery.createMany({
    data: [{ id, event, payload }],
    skipDuplicates: true,
  });
  return count === 1;
};

export const findNextDueDelivery = async (tx: Prisma.TransactionClient) => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM github_delivery WHERE "processedAt" IS NULL AND "failedAt" IS NULL
    AND "nextAttemptAt" <= now() ORDER BY "nextAttemptAt", id LIMIT 1 FOR UPDATE SKIP LOCKED`;
  return rows[0]
    ? tx.githubDelivery.findUnique({ where: { id: rows[0].id } })
    : null;
};

export const markDeliveryProcessed = (
  tx: Prisma.TransactionClient,
  id: string,
) =>
  tx.githubDelivery.update({
    where: { id },
    data: { processedAt: new Date(), lastError: null },
  });

export const lockDelivery = async (
  tx: Prisma.TransactionClient,
  id: string,
) => {
  await tx.$queryRaw`SELECT id FROM github_delivery WHERE id = ${id} FOR UPDATE`;
  return tx.githubDelivery.findUnique({ where: { id } });
};

export const updateDelivery = (
  tx: Prisma.TransactionClient,
  id: string,
  data: {
    attempts: number;
    nextAttemptAt: Date;
    failedAt: Date | null;
    lastError: string | null;
  },
) => tx.githubDelivery.update({ where: { id }, data });

/** Failed deliveries go back in the queue. Returns how many. */
export const requeueFailedDeliveries = async () => {
  const { count } = await prisma.githubDelivery.updateMany({
    where: { failedAt: { not: null } },
    data: {
      attempts: 0,
      nextAttemptAt: new Date(),
      failedAt: null,
      lastError: null,
    },
  });
  return count;
};

export const upsertInstallation = (
  tx: Prisma.TransactionClient,
  id: number,
  accountLogin: string,
) =>
  tx.githubInstallation.upsert({
    where: { id },
    create: { id, accountLogin },
    update: { accountLogin, deletedAt: null },
  });

export const markInstallationDeleted = (
  tx: Prisma.TransactionClient,
  id: number,
) =>
  tx.githubInstallation.updateMany({
    where: { id },
    data: { deletedAt: new Date() },
  });

export const upsertRepository = (
  tx: Prisma.TransactionClient,
  id: number,
  installationId: number,
  fullName: string,
) =>
  tx.githubRepository.upsert({
    where: { id },
    create: { id, installationId, fullName },
    update: { installationId, fullName, removedAt: null },
  });

export const markRepositoriesRemoved = (
  tx: Prisma.TransactionClient,
  ids: number[],
) =>
  tx.githubRepository.updateMany({
    where: { id: { in: ids } },
    data: { removedAt: new Date() },
  });

/** A repo of a live installation that has not been removed, with the live projects it is mapped to. */
export const findLiveMappedRepository = (
  tx: Prisma.TransactionClient,
  id: number,
) =>
  tx.githubRepository.findFirst({
    where: { id, removedAt: null, installation: { deletedAt: null } },
    select: {
      projects: {
        where: { project: { deletedAt: null } },
        select: { project: { select: { id: true, keyPrefix: true } } },
      },
    },
  });

export const findRepositoryId = (tx: Prisma.TransactionClient, id: number) =>
  tx.githubRepository.findUnique({ where: { id }, select: { id: true } });

export const findPullRequest = (
  tx: Prisma.TransactionClient,
  repositoryId: number,
  number: number,
) =>
  tx.pullRequest.findUnique({
    where: { repositoryId_number: { repositoryId, number } },
    select: { id: true, githubUpdatedAt: true },
  });

export const upsertPullRequest = (
  tx: Prisma.TransactionClient,
  repositoryId: number,
  number: number,
  data: PullRequestData,
) =>
  tx.pullRequest.upsert({
    where: { repositoryId_number: { repositoryId, number } },
    create: { repositoryId, number, ...data },
    update: data,
    select: { id: true },
  });

/** Live items (in live projects) with these numbers, one lookup for all the keys. */
export const findLiveItems = (
  tx: Prisma.TransactionClient,
  keys: { projectId: string; number: number }[],
) =>
  tx.item.findMany({
    where: {
      deletedAt: null,
      project: { deletedAt: null },
      OR: keys.map((key) => ({
        projectId: key.projectId,
        number: key.number,
      })),
    },
    select: { id: true, projectId: true, number: true },
  });

export const upsertPullRequestItem = (
  tx: Prisma.TransactionClient,
  pullRequestId: string,
  itemId: string,
  closes: boolean,
) =>
  tx.pullRequestItem.upsert({
    where: { pullRequestId_itemId: { pullRequestId, itemId } },
    create: { pullRequestId, itemId, closes },
    update: { closes },
  });

export const findCheckSuite = (tx: Prisma.TransactionClient, id: number) =>
  tx.checkSuite.findUnique({ where: { id }, select: { status: true } });

export const upsertCheckSuite = (
  tx: Prisma.TransactionClient,
  id: number,
  data: {
    repositoryId: number;
    headSha: string;
    appName: string;
    status: string;
    conclusion: string | null;
  },
) =>
  tx.checkSuite.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });

export const findItemPullRequests = (itemId: string) =>
  prisma.pullRequestItem.findMany({
    where: { itemId },
    select: {
      closes: true,
      pullRequest: {
        select: {
          number: true,
          title: true,
          url: true,
          state: true,
          headRef: true,
          headSha: true,
          baseRef: true,
          authorLogin: true,
          mergedByLogin: true,
          repositoryId: true,
          repository: { select: { fullName: true } },
        },
      },
    },
    orderBy: { pullRequest: { githubUpdatedAt: 'desc' } },
  });

/** Pass `prisma`, or the worker's `tx` to see suites it just wrote. */
/** Pass `db` only inside a transaction, so suites written earlier in it are seen. */
export const findCheckSuites = (
  commits: { repositoryId: bigint; headSha: string }[],
  db: Prisma.TransactionClient = prisma,
) =>
  commits.length === 0
    ? []
    : db.checkSuite.findMany({
        where: { OR: commits },
        select: {
          repositoryId: true,
          headSha: true,
          status: true,
          conclusion: true,
        },
      });

/** The repos of live installations that are not removed, with whether this project maps each. */
export const findProjectRepositories = (projectId: string) =>
  prisma.githubRepository.findMany({
    where: { removedAt: null, installation: { deletedAt: null } },
    select: {
      id: true,
      fullName: true,
      projects: { where: { projectId }, select: { projectId: true } },
    },
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
  });

export const findLiveRepository = (id: bigint) =>
  prisma.githubRepository.findFirst({
    where: { id, removedAt: null, installation: { deletedAt: null } },
    select: { id: true, fullName: true },
  });

export const mapRepository = (projectId: string, repositoryId: bigint) =>
  prisma.projectRepository.createMany({
    data: [{ projectId, repositoryId }],
    skipDuplicates: true,
  });

export const unmapRepository = (projectId: string, repositoryId: bigint) =>
  prisma.projectRepository.deleteMany({ where: { projectId, repositoryId } });

/** Unsettled closing links of this pull request whose project moves tickets to Done on merge. */
export const findDoneCandidates = (
  tx: Prisma.TransactionClient,
  pullRequestId: string,
) =>
  tx.pullRequestItem.findMany({
    where: {
      pullRequestId,
      closes: true,
      settledAt: null,
      item: {
        deletedAt: null,
        project: { deletedAt: null, doneOnMerge: true },
      },
    },
    select: {
      item: {
        select: {
          id: true,
          projectId: true,
          kind: true,
          state: { select: { key: true, category: true } },
          project: {
            select: { checklistRequired: true, checklistMin: true },
          },
        },
      },
    },
  });

/** Every closing pull request of the ticket, with its repository for the check lookup. */
export const findClosingPullRequests = (
  tx: Prisma.TransactionClient,
  itemId: string,
) =>
  tx.pullRequestItem.findMany({
    where: { itemId, closes: true },
    select: {
      pullRequestId: true,
      pullRequest: {
        select: {
          number: true,
          url: true,
          repositoryId: true,
          headRef: true,
          headSha: true,
          baseRef: true,
          state: true,
          mergedByLogin: true,
        },
      },
    },
    orderBy: { pullRequest: { number: 'asc' } },
  });

export const findChecklist = (tx: Prisma.TransactionClient, itemId: string) =>
  tx.checklistEntry.findMany({
    where: { itemId },
    select: { text: true, done: true },
    orderBy: { position: 'asc' },
  });

/** Keys of the blockers that are not finished yet. */
export const findOpenBlockerKeys = async (
  tx: Prisma.TransactionClient,
  itemId: string,
) => {
  const links = await tx.itemBlock.findMany({
    where: {
      blockedId: itemId,
      blocker: { state: { category: { notIn: ['DONE', 'CANCELED'] } } },
    },
    select: {
      blocker: {
        select: { number: true, project: { select: { keyPrefix: true } } },
      },
    },
  });
  return links.map(
    ({ blocker }) => `${blocker.project.keyPrefix}-${blocker.number}`,
  );
};

export const findFirstDoneState = (
  tx: Prisma.TransactionClient,
  projectId: string,
) =>
  tx.state.findFirst({
    where: { projectId, category: 'DONE' },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

/** Marks the ticket's links to merged pull requests as spent: they never move it again. */
export const settleLinks = (
  tx: Prisma.TransactionClient,
  itemId: string,
  pullRequestIds: string[],
) =>
  tx.pullRequestItem.updateMany({
    where: { itemId, pullRequestId: { in: pullRequestIds }, settledAt: null },
    data: { settledAt: new Date() },
  });

/** Merged pull requests into dev or main with this commit; the ones a finished check suite can release. */
export const findMergedPullRequestIds = async (
  tx: Prisma.TransactionClient,
  repositoryId: number,
  headSha: string,
  baseRefs: string[],
) => {
  const rows = await tx.pullRequest.findMany({
    where: {
      repositoryId,
      headSha,
      state: 'MERGED',
      baseRef: { in: baseRefs },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
};
