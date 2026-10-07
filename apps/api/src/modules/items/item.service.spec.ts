import {
  checklistError,
  featureDone,
  kindError,
  mayAssign,
  mayMove,
  mayMoveToDone,
  wouldCreateCycle,
} from './item.rules.js';

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
      expect(mayAssign(role, 'me', null, 'mya', true)).toBe(true);
      expect(mayAssign(role, 'me', 'mya', 'ko', true)).toBe(true);
      expect(mayAssign(role, 'me', 'mya', null, true)).toBe(true);
      expect(mayAssign(role, 'me', null, 'me', true)).toBe(true);
    },
  );

  it('lets a member claim a free ticket and unclaim their own', () => {
    expect(mayAssign('MEMBER', 'me', null, 'me', true)).toBe(true);
    expect(mayAssign('MEMBER', 'me', 'me', null, true)).toBe(true);
  });

  it('refuses a member claim when self-claim is off, but lets them unclaim', () => {
    expect(mayAssign('MEMBER', 'me', null, 'me', false)).toBe(false);
    expect(mayAssign('MEMBER', 'me', 'me', null, false)).toBe(true);
  });

  it('lets owners and managers assign when self-claim is off', () => {
    expect(mayAssign('OWNER', 'me', null, 'mya', false)).toBe(true);
    expect(mayAssign('MANAGER', 'me', null, 'me', false)).toBe(true);
  });

  it.each([
    [null, 'mya'], // assign someone else
    ['mya', 'me'], // take Mya's ticket
    ['mya', null], // unassign someone else
    ['mya', 'ko'], // reassign
    ['me', 'mya'], // hand over their own
  ] as const)('refuses a member changing %s to %s', (from, to) => {
    expect(mayAssign('MEMBER', 'me', from, to, true)).toBe(false);
  });
});

describe('mayMove', () => {
  it.each(['OWNER', 'MANAGER'] as const)('lets %s move any ticket', (role) => {
    expect(mayMove(role, 'me', null, null)).toBe(true);
    expect(mayMove(role, 'me', 'mya', null)).toBe(true);
    expect(mayMove(role, 'me', 'me', null)).toBe(true);
  });

  it('lets a member move only a ticket assigned to them', () => {
    expect(mayMove('MEMBER', 'me', 'me', null)).toBe(true);
    expect(mayMove('MEMBER', 'me', 'mya', null)).toBe(false);
    expect(mayMove('MEMBER', 'me', null, null)).toBe(false);
  });
});

describe('review handoff', () => {
  it('locks assigned members after review submission, including member no-ops', () => {
    expect(mayMove('MEMBER', 'me', 'me', 'in_review')).toBe(false);
    expect(mayMove('MEMBER', 'me', 'me', 'in_progress')).toBe(true);
  });
  it.each(['OWNER', 'MANAGER'] as const)(
    'allows %s to review their own or another assignee',
    (role) => {
      expect(mayMove(role, 'me', 'me', 'in_review')).toBe(true);
      expect(mayMove(role, 'me', 'other', 'in_review')).toBe(true);
    },
  );
});

describe('mayMoveToDone', () => {
  it('lets owners and managers, not members', () => {
    expect(mayMoveToDone('OWNER')).toBe(true);
    expect(mayMoveToDone('MANAGER')).toBe(true);
    expect(mayMoveToDone('MEMBER')).toBe(false);
  });
});

describe('checklistError', () => {
  const guided = { checklistRequired: true, checklistMin: 3 };
  const entry = (text: string, done: boolean) => ({ text, done });
  const full = [entry('a', true), entry('b', true), entry('c', true)];
  const review = { key: 'in_review', category: 'STARTED' } as const;
  const done = { key: 'done', category: 'DONE' } as const;
  const started = { key: 'in_progress', category: 'STARTED' } as const;

  it('allows a full, ticked checklist into In Review and Done', () => {
    expect(checklistError(guided, 'SLICE', full, review)).toBeNull();
    expect(checklistError(guided, 'SLICE', full, done)).toBeNull();
    expect(checklistError(guided, 'SUBTASK', full, done)).toBeNull();
  });

  it('names how many entries are missing', () => {
    expect(
      checklistError(guided, 'SLICE', [entry('a', true)], review),
    ).toContain('at least 3');
  });

  it('names the unticked entries', () => {
    const error = checklistError(
      guided,
      'SLICE',
      [entry('a', true), entry('Write tests', false), entry('Docs', false)],
      done,
    );
    expect(error).toContain('"Write tests"');
    expect(error).toContain('"Docs"');
    expect(error).not.toContain('"a"');
  });

  it('applies to a Done state without the done key (Standard)', () => {
    expect(
      checklistError(guided, 'SUBTASK', [], { key: null, category: 'DONE' }),
    ).toEqual(expect.any(String));
  });

  it('never gates other states or Canceled, even with unticked entries', () => {
    const open = [entry('x', false)];
    const canceled = { key: 'canceled', category: 'CANCELED' } as const;
    expect(checklistError(guided, 'SLICE', open, started)).toBeNull();
    expect(checklistError(guided, 'SLICE', open, canceled)).toBeNull();
  });

  it.each([
    ['an empty feature', guided, 'FEATURE', done],
    ['an empty task', guided, 'TASK', done],
    [
      'an empty slice when the switch is off',
      { checklistRequired: false, checklistMin: 3 },
      'SLICE',
      done,
    ],
  ] as const)('has no minimum for %s', (_name, project, kind, target) => {
    expect(checklistError(project, kind, [], target)).toBeNull();
  });

  it('wants every entry ticked on any item, even with the switch off', () => {
    const off = { checklistRequired: false, checklistMin: null };
    for (const kind of ['FEATURE', 'TASK', 'SLICE'] as const)
      expect(checklistError(off, kind, [entry('x', false)], done)).toContain(
        '"x"',
      );
    expect(checklistError(off, 'TASK', [entry('x', true)], done)).toBeNull();
  });

  it('has no minimum when checklistMin is null, but still wants ticks', () => {
    const project = { checklistRequired: true, checklistMin: null };
    expect(checklistError(project, 'SLICE', [], done)).toBeNull();
    expect(checklistError(project, 'SLICE', [entry('a', false)], done)).toEqual(
      expect.any(String),
    );
  });
});

describe('featureDone', () => {
  const child = (category: 'BACKLOG' | 'STARTED' | 'DONE' | 'CANCELED') => ({
    state: { category },
  });

  it('is true when every slice is Done or Canceled', () => {
    expect(featureDone([child('DONE'), child('CANCELED')])).toBe(true);
  });

  it('is false while a slice is open, and with no slices', () => {
    expect(featureDone([child('DONE'), child('STARTED')])).toBe(false);
    expect(featureDone([child('BACKLOG')])).toBe(false);
    expect(featureDone([])).toBe(false);
  });
});
