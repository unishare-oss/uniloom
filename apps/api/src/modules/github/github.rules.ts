import type { PullRequestState } from '@/generated/prisma/enums.js';
import { branchKey } from './github.utils.js';
import type {
  CheckResult,
  CheckSuiteState,
  DoneBlocker,
  DonePullRequest,
} from './github.types.js';

const PASSING = ['success', 'neutral', 'skipped'];

/** One result for a commit's check suites: unfinished is pending, any bad conclusion is a failure. */
export const checkResult = (suites: CheckSuiteState[]): CheckResult => {
  if (suites.length === 0) return 'none';
  if (suites.some((suite) => suite.status !== 'completed')) return 'pending';
  if (suites.some((suite) => !PASSING.includes(suite.conclusion ?? '')))
    return 'failure';
  return 'success';
};

/** One pull request's check result, from the suites on its repository and head commit. */
export const checksFor = (
  pr: { repositoryId: bigint; headSha: string },
  suites: (CheckSuiteState & { repositoryId: bigint; headSha: string })[],
) =>
  checkResult(
    suites.filter(
      (suite) =>
        suite.repositoryId === pr.repositoryId && suite.headSha === pr.headSha,
    ),
  );

/** Branches that carry finished work: a merge into one of them can move a ticket to Done. */
export const RELEASE_BRANCHES = ['dev', 'main'];

/** Merged into dev or main: the work is finished. */
export const mergedIntoRelease = (pr: {
  state: PullRequestState;
  baseRef: string;
}) => pr.state === 'MERGED' && RELEASE_BRANCHES.includes(pr.baseRef);

/**
 * What stops a ticket from moving to Done after a merge; empty means it can move. Closing pull
 * requests are grouped by repository and head branch: a group with an open PR or a PR merged
 * into dev or main needs one merge into dev or main, so the same branch into dev and main counts
 * once. A group whose PRs were all closed unmerged is ignored.
 */
export const doneBlockers = (
  stateKey: string | null,
  pullRequests: DonePullRequest[],
  checklistError: string | null,
  blockerKeys: string[],
): DoneBlocker[] => {
  const blockers: DoneBlocker[] = [];
  if (stateKey !== 'in_review')
    blockers.push({ reason: 'Not in In Review', waiting: false });
  if (checklistError) blockers.push({ reason: checklistError, waiting: false });
  if (blockerKeys.length > 0)
    blockers.push({
      reason: `Blocked by ${blockerKeys.join(', ')}`,
      waiting: false,
    });

  const groups = new Map<string, DonePullRequest[]>();
  for (const pr of pullRequests) {
    const key = branchKey(pr);
    groups.set(key, [...(groups.get(key) ?? []), pr]);
  }
  const merged = pullRequests.filter(mergedIntoRelease);
  if (merged.length === 0)
    blockers.push({
      reason: 'No pull request is merged into dev or main yet',
      waiting: true,
    });
  for (const group of groups.values()) {
    if (group.some(mergedIntoRelease)) continue;
    for (const pr of group.filter((row) => row.state === 'OPEN'))
      blockers.push({
        reason: `PR #${pr.number} (${pr.headRef} → ${pr.baseRef}) is still open`,
        waiting: true,
      });
  }
  for (const pr of merged) {
    if (pr.checks === 'failure')
      blockers.push({
        reason: `Checks failed on PR #${pr.number}`,
        waiting: false,
      });
    if (pr.checks === 'pending')
      blockers.push({
        reason: `Checks still running on PR #${pr.number}`,
        waiting: true,
      });
  }
  return blockers;
};
