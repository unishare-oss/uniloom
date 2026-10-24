import type { CheckResult, CheckSuiteState } from './github.types.js';

const PASSING = ['success', 'neutral', 'skipped'];

/** One result for a commit's check suites: unfinished is pending, any bad conclusion is a failure. */
export const checkResult = (suites: CheckSuiteState[]): CheckResult => {
  if (suites.length === 0) return 'none';
  if (suites.some((suite) => suite.status !== 'completed')) return 'pending';
  if (suites.some((suite) => !PASSING.includes(suite.conclusion ?? '')))
    return 'failure';
  return 'success';
};
