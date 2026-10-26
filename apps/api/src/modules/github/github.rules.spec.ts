import { checkResult, doneBlockers } from './github.rules.js';
import type { DonePullRequest } from './github.types.js';

const done = (conclusion: string) => ({ status: 'completed', conclusion });

describe('checkResult', () => {
  it('is none without suites', () => {
    expect(checkResult([])).toBe('none');
  });

  it('is pending while a suite is not completed', () => {
    expect(
      checkResult([
        done('success'),
        { status: 'in_progress', conclusion: null },
      ]),
    ).toBe('pending');
  });

  it('is failure for any conclusion that is not success, neutral or skipped', () => {
    expect(checkResult([done('success'), done('failure')])).toBe('failure');
    expect(checkResult([done('cancelled')])).toBe('failure');
  });

  it('is success when all pass', () => {
    expect(
      checkResult([done('success'), done('neutral'), done('skipped')]),
    ).toBe('success');
  });
});

const pr = (overrides: Partial<DonePullRequest> = {}): DonePullRequest => ({
  number: 12,
  repositoryId: 1n,
  headRef: 'un-42',
  baseRef: 'dev',
  state: 'MERGED',
  checks: 'success',
  ...overrides,
});

describe('doneBlockers', () => {
  it('is empty when In Review, ticked, unblocked, merged and green', () => {
    expect(doneBlockers('in_review', [pr()], null, [])).toEqual([]);
    expect(
      doneBlockers('in_review', [pr({ checks: 'none' })], null, []),
    ).toEqual([]);
  });

  it('names a ticket that is not In Review, an unticked checklist and a blocker', () => {
    const blockers = doneBlockers(
      'in_progress',
      [pr()],
      'Tick every checklist entry first: "a"',
      ['UN-7'],
    );
    expect(blockers).toEqual([
      { reason: 'Not in In Review', waiting: false },
      { reason: 'Tick every checklist entry first: "a"', waiting: false },
      { reason: 'Blocked by UN-7', waiting: false },
    ]);
  });

  it('stops on failed checks and waits on running ones', () => {
    expect(
      doneBlockers('in_review', [pr({ checks: 'failure' })], null, []),
    ).toEqual([{ reason: 'Checks failed on PR #12', waiting: false }]);
    expect(
      doneBlockers('in_review', [pr({ checks: 'pending' })], null, []),
    ).toEqual([{ reason: 'Checks still running on PR #12', waiting: true }]);
  });

  it('waits while another branch has an open PR', () => {
    const open = pr({ number: 13, headRef: 'un-42-web', state: 'OPEN' });
    expect(doneBlockers('in_review', [pr(), open], null, [])).toEqual([
      { reason: 'PR #13 (un-42-web → dev) is still open', waiting: true },
    ]);
  });

  it('counts the same branch into dev and main once, on the first merge', () => {
    const main = pr({ number: 13, baseRef: 'main', state: 'OPEN' });
    expect(doneBlockers('in_review', [pr(), main], null, [])).toEqual([]);
  });

  it('ignores a branch whose PRs were all closed unmerged, or merged elsewhere', () => {
    const closed = pr({ number: 14, headRef: 'old', state: 'CLOSED' });
    const feature = pr({ number: 15, headRef: 'x', baseRef: 'feature-x' });
    expect(
      doneBlockers('in_review', [pr(), closed, feature], null, []),
    ).toEqual([]);
  });

  it('waits when nothing is merged into dev or main', () => {
    expect(
      doneBlockers('in_review', [pr({ baseRef: 'feature-x' })], null, []),
    ).toEqual([
      {
        reason: 'No pull request is merged into dev or main yet',
        waiting: true,
      },
    ]);
  });
});
