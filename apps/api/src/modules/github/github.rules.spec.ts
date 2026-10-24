import { checkResult } from './github.rules.js';

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
