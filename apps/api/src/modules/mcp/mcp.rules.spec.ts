import { isPeopleOnlyTarget } from './mcp.rules.js';

describe('isPeopleOnlyTarget', () => {
  it('is true for Ready', () => {
    expect(isPeopleOnlyTarget({ key: 'ready', category: 'UNSTARTED' })).toBe(
      true,
    );
  });

  it('is true for any state in the Done category, even a custom one', () => {
    expect(isPeopleOnlyTarget({ key: 'done', category: 'DONE' })).toBe(true);
    expect(isPeopleOnlyTarget({ key: null, category: 'DONE' })).toBe(true);
  });

  it('is false for the other states', () => {
    expect(
      isPeopleOnlyTarget({ key: 'in_progress', category: 'STARTED' }),
    ).toBe(false);
    expect(isPeopleOnlyTarget({ key: 'in_review', category: 'STARTED' })).toBe(
      false,
    );
    expect(isPeopleOnlyTarget({ key: 'canceled', category: 'CANCELED' })).toBe(
      false,
    );
    expect(isPeopleOnlyTarget({ key: null, category: 'UNSTARTED' })).toBe(
      false,
    );
  });
});
