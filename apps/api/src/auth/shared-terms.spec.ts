import { sharedTerms } from './shared-terms.js';

describe('sharedTerms', () => {
  it('copies the original timestamp from the current signed acceptance', () => {
    expect(
      sharedTerms({
        'urn:unicorp:terms': { version: 1, acceptedAt: '2026-10-21T00:00:00Z' },
      }),
    ).toEqual({
      unicorpTermsVersion: 1,
      unicorpTermsAcceptedAt: new Date('2026-10-21T00:00:00Z'),
    });
  });
  it.each([
    {},
    { consentGivenAt: new Date() },
    { 'urn:unicorp:terms': { version: 0, acceptedAt: '2026-10-21' } },
    { 'urn:unicorp:terms': { version: 1, acceptedAt: 'invalid' } },
  ])('does not infer shared acceptance from %j', (profile) => {
    expect(sharedTerms(profile)).toEqual({
      unicorpTermsVersion: null,
      unicorpTermsAcceptedAt: null,
    });
  });
});
