import { nextStatusError, sourceProposalError } from './document.rules.js';

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

describe('sourceProposalError', () => {
  const source = {
    id: 'p',
    projectId: 'project',
    kind: 'PROPOSAL' as const,
    homeItemId: null,
    archivedAt: null,
  };
  it('accepts absent fields, optional specs and active proposals', () => {
    expect(sourceProposalError('SLA', undefined, null, 'project')).toBeNull();
    expect(sourceProposalError('SPEC', null, null, 'project')).toBeNull();
    expect(sourceProposalError('SPEC', 'p', source, 'project')).toBeNull();
  });
  it('rejects even explicit null on non-spec documents', () => {
    expect(sourceProposalError('REFERENCE', null, null, 'project')).toBe(
      'invalid_source_proposal',
    );
  });
  it('hides missing and foreign sources before checking kind or archive', () => {
    expect(sourceProposalError('SPEC', 'p', null, 'project')).toBe('not_found');
    expect(
      sourceProposalError(
        'SPEC',
        'p',
        { ...source, kind: 'SLO', archivedAt: new Date() },
        'foreign',
      ),
    ).toBe('not_found');
  });
  it('rejects wrong kinds and ticket homes', () => {
    expect(
      sourceProposalError('SPEC', 'p', { ...source, kind: 'SPEC' }, 'project'),
    ).toBe('invalid_source_proposal');
    expect(
      sourceProposalError(
        'SPEC',
        'p',
        { ...source, homeItemId: 'ticket' },
        'project',
      ),
    ).toBe('invalid_source_proposal');
  });
  it('allows retaining an archived source but forbids newly assigning it', () => {
    const archived = { ...source, archivedAt: new Date() };
    expect(
      sourceProposalError('SPEC', 'p', archived, 'project', 'p'),
    ).toBeNull();
    expect(sourceProposalError('SPEC', 'p', archived, 'project')).toBe(
      'document_archived',
    );
  });
});
