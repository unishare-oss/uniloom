import { kindError, mayAssign, wouldCreateCycle } from './item.service.js';

describe('kindError', () => {
  it.each([
    ['GUIDED', 'FEATURE', null],
    ['GUIDED', 'SLICE', 'FEATURE'],
    ['STANDARD', 'TASK', null],
    ['STANDARD', 'SUBTASK', 'TASK'],
  ] as const)('%s allows a %s under %s', (mode, kind, parent) => {
    expect(kindError(mode, kind, parent)).toBeNull();
  });

  it.each([
    ['GUIDED', 'TASK', null], // a Standard kind
    ['STANDARD', 'SLICE', null], // a Guided kind
    ['GUIDED', 'SLICE', null], // a slice needs a feature
    ['GUIDED', 'FEATURE', 'FEATURE'], // two levels only
    ['GUIDED', 'SLICE', 'SLICE'], // a slice can't have slices
    ['STANDARD', 'SUBTASK', null], // a subtask needs a task
    ['STANDARD', 'TASK', 'TASK'], // a task can't be under anything
    ['STANDARD', 'TASK', 'SUBTASK'],
    ['STANDARD', 'SUBTASK', 'SUBTASK'],
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

describe('mayAssign', () => {
  it.each(['OWNER', 'MANAGER'] as const)(
    'lets %s set anyone or nobody',
    (role) => {
      expect(mayAssign(role, 'me', null, 'mya')).toBe(true);
      expect(mayAssign(role, 'me', 'mya', 'ko')).toBe(true);
      expect(mayAssign(role, 'me', 'mya', null)).toBe(true);
      expect(mayAssign(role, 'me', null, 'me')).toBe(true);
    },
  );

  it('lets a member claim a free ticket and unclaim their own', () => {
    expect(mayAssign('MEMBER', 'me', null, 'me')).toBe(true);
    expect(mayAssign('MEMBER', 'me', 'me', null)).toBe(true);
  });

  it.each([
    [null, 'mya'], // assign someone else
    ['mya', 'me'], // take Mya's ticket
    ['mya', null], // unassign someone else
    ['mya', 'ko'], // reassign
    ['me', 'mya'], // hand over their own
  ] as const)('refuses a member changing %s to %s', (from, to) => {
    expect(mayAssign('MEMBER', 'me', from, to)).toBe(false);
  });
});
