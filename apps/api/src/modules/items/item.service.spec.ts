import { kindError, wouldCreateCycle } from './item.service.js';

describe('kindError', () => {
  it.each([
    ['GUIDED', 'FEATURE', null],
    ['GUIDED', 'SLICE', 'FEATURE'],
    ['STANDARD', 'PROJECT', null],
    ['STANDARD', 'ISSUE', null],
    ['STANDARD', 'ISSUE', 'PROJECT'],
    ['STANDARD', 'SUB_ISSUE', 'ISSUE'],
  ] as const)('%s allows a %s under %s', (mode, kind, parent) => {
    expect(kindError(mode, kind, parent)).toBeNull();
  });

  it.each([
    ['GUIDED', 'ISSUE', null], // a Standard kind
    ['STANDARD', 'SLICE', null], // a Guided kind
    ['GUIDED', 'SLICE', null], // a slice needs a feature
    ['GUIDED', 'FEATURE', 'FEATURE'], // two levels only
    ['GUIDED', 'SLICE', 'SLICE'], // a slice can't have slices
    ['STANDARD', 'PROJECT', 'PROJECT'],
    ['STANDARD', 'SUB_ISSUE', null],
    ['STANDARD', 'SUB_ISSUE', 'PROJECT'],
    ['STANDARD', 'ISSUE', 'ISSUE'],
  ] as const)('%s refuses a %s under %s', (mode, kind, parent) => {
    expect(kindError(mode, kind, parent)).toEqual(expect.any(String));
  });
});

describe('wouldCreateCycle', () => {
  const link = (blockedId: string, blockerId: string) => ({
    blockedId,
    blockerId,
  });

  it('allows a link with no path back', () => {
    expect(wouldCreateCycle([link('A', 'B')], 'C', 'A')).toBe(false);
  });

  it('refuses a direct loop: A waits on B, then B on A', () => {
    expect(wouldCreateCycle([link('A', 'B')], 'B', 'A')).toBe(true);
  });

  it('refuses a longer loop: A → B → C, then C on A', () => {
    expect(wouldCreateCycle([link('A', 'B'), link('B', 'C')], 'C', 'A')).toBe(
      true,
    );
  });

  it('handles shared blockers without looping forever', () => {
    const links = [link('A', 'C'), link('B', 'C'), link('C', 'D')];
    expect(wouldCreateCycle(links, 'D', 'A')).toBe(true);
    expect(wouldCreateCycle(links, 'E', 'A')).toBe(false);
  });
});
