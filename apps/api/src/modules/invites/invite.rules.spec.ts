import { linkState } from './invite.rules.js';

const NOW = new Date('2026-10-13T12:00:00Z');
const LATER = new Date('2026-10-14T12:00:00Z');
const EARLIER = new Date('2026-10-13T11:59:59Z');

const link = (
  overrides: Partial<Parameters<typeof linkState>[0]> = {},
): Parameters<typeof linkState>[0] => ({
  revokedAt: null,
  expiresAt: LATER,
  maxUses: null,
  useCount: 0,
  ...overrides,
});

describe('linkState', () => {
  it('is live before its expiry with no limit', () => {
    expect(linkState(link({ useCount: 500 }), NOW)).toBe('live');
  });

  it('is live while slots are left', () => {
    expect(linkState(link({ maxUses: 3, useCount: 2 }), NOW)).toBe('live');
  });

  it('is full once every slot is used', () => {
    expect(linkState(link({ maxUses: 3, useCount: 3 }), NOW)).toBe('full');
  });

  it('is expired at its expiry time and after', () => {
    expect(linkState(link({ expiresAt: NOW }), NOW)).toBe('expired');
    expect(linkState(link({ expiresAt: EARLIER }), NOW)).toBe('expired');
  });

  it('is expired, not full, when both are true', () => {
    expect(
      linkState(link({ expiresAt: EARLIER, maxUses: 1, useCount: 1 }), NOW),
    ).toBe('expired');
  });

  it('is revoked whatever else is true', () => {
    expect(linkState(link({ revokedAt: EARLIER }), NOW)).toBe('revoked');
    expect(
      linkState(link({ revokedAt: EARLIER, expiresAt: EARLIER }), NOW),
    ).toBe('revoked');
  });
});
