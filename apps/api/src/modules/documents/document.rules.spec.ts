import { nextStatusError } from './document.rules.js';

describe('nextStatusError', () => {
  it('lets a Proposed ADR be accepted or rejected', () => {
    expect(nextStatusError('ADR', 'PROPOSED', 'ACCEPTED')).toBeNull();
    expect(nextStatusError('ADR', 'PROPOSED', 'REJECTED')).toBeNull();
  });

  it('lets an Accepted ADR be superseded', () => {
    expect(nextStatusError('ADR', 'ACCEPTED', 'SUPERSEDED')).toBeNull();
  });

  it('refuses every other move', () => {
    expect(nextStatusError('ADR', 'PROPOSED', 'SUPERSEDED')).toMatch(/can't/);
    expect(nextStatusError('ADR', 'ACCEPTED', 'REJECTED')).toMatch(/can't/);
    expect(nextStatusError('ADR', 'REJECTED', 'ACCEPTED')).toMatch(/can't/);
    expect(nextStatusError('ADR', 'SUPERSEDED', 'ACCEPTED')).toMatch(/can't/);
    expect(nextStatusError('ADR', 'PROPOSED', 'PROPOSED')).toMatch(/can't/);
    expect(nextStatusError('ADR', null, 'ACCEPTED')).toMatch(/can't/);
  });

  it('refuses a document that is not an ADR', () => {
    expect(nextStatusError('SPEC', null, 'ACCEPTED')).toBe(
      'Only ADRs and tech debt have a status',
    );
  });

  it('lets open tech debt be fixed or dropped', () => {
    expect(nextStatusError('TECH_DEBT', 'OPEN', 'FIXED')).toBeNull();
    expect(nextStatusError('TECH_DEBT', 'OPEN', 'WONT_FIX')).toBeNull();
  });

  it('keeps closed tech debt closed and refuses ADR statuses on it', () => {
    expect(nextStatusError('TECH_DEBT', 'FIXED', 'OPEN')).toMatch(/can't/);
    expect(nextStatusError('TECH_DEBT', 'WONT_FIX', 'FIXED')).toMatch(/can't/);
    expect(nextStatusError('TECH_DEBT', 'OPEN', 'ACCEPTED')).toMatch(/can't/);
    expect(nextStatusError('ADR', 'PROPOSED', 'OPEN')).toMatch(/can't/);
  });
});
