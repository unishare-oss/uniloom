import { resetLookups, takeLookup } from './member.rate-limit.js';

describe('add-by-email lookup limit', () => {
  beforeEach(resetLookups);

  it('allows 20 lookups per person per hour, then refuses until the window moves', () => {
    const start = 1_000_000;
    for (let i = 0; i < 20; i++) expect(takeLookup('u1', start + i)).toBe(true);
    expect(takeLookup('u1', start + 30)).toBe(false);
    expect(takeLookup('u2', start + 30)).toBe(true); // per person
    expect(takeLookup('u1', start + 60 * 60 * 1000 + 25)).toBe(true);
  });
});
