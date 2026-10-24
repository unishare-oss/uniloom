import type { PullRequestState } from '@/generated/prisma/enums.js';

/** A key found in a text, e.g. UN-42, and whether the text says it closes the ticket. */
export interface FoundKey {
  key: string;
  closes: boolean;
}

export interface CheckSuiteState {
  status: string;
  conclusion: string | null;
}

export type CheckResult = 'none' | 'pending' | 'failure' | 'success';

/** The parts of GitHub's webhook payloads that are read. Everything else is ignored. */
export interface InstallationPayload {
  action: string;
  installation: { id: number; account: { login: string } };
  repositories?: { id: number; full_name: string }[];
  repositories_added?: { id: number; full_name: string }[];
  repositories_removed?: { id: number }[];
}

export interface PullRequestPayload {
  action: string;
  repository: { id: number };
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: 'open' | 'closed';
    merged?: boolean;
    merged_at: string | null;
    merged_by?: { login: string } | null;
    user: { login: string };
    head: { ref: string; sha: string };
    base: { ref: string };
    updated_at: string;
  };
}

export interface CheckSuitePayload {
  action: string;
  repository: { id: number };
  check_suite: {
    id: number;
    head_sha: string;
    status: string;
    conclusion: string | null;
    app?: { name: string } | null;
  };
}

export interface PullRequestData {
  title: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  state: PullRequestState;
  mergedAt: Date | null;
  mergedByLogin: string | null;
  authorLogin: string;
  url: string;
  githubUpdatedAt: Date;
}

/** One closing pull request of a ticket, as `doneBlockers` reads it. */
export interface DonePullRequest {
  number: number;
  repositoryId: bigint;
  headRef: string;
  baseRef: string;
  state: PullRequestState;
  checks: CheckResult;
}

export interface DoneBlocker {
  reason: string;
  /** True when time alone may fix it (another branch open, checks running); nothing is logged. */
  waiting: boolean;
}
