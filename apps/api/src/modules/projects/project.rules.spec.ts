import { limitsError } from './project.rules.js';

describe('limitsError', () => {
  it.each([
    [null, null],
    [3, null],
    [null, 6],
    [3, 6],
    [4, 4],
  ] as const)('accepts min %s and max %s', (min, max) => {
    expect(limitsError(min, max)).toBeNull();
  });

  it('refuses a limit below 1', () => {
    expect(limitsError(0, null)).toMatch(/at least 1/);
    expect(limitsError(null, 0)).toMatch(/at least 1/);
  });

  it('refuses a minimum above the maximum', () => {
    expect(limitsError(5, 3)).toMatch(/can't be above/);
  });
});
