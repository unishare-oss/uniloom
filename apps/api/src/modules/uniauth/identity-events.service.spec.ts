import { reconcileIntervalMs } from './identity-events.service.js';

describe('UNIAUTH_RECONCILE_HOURS', () => {
  it('defaults to 6 hours when empty or unset', () => {
    for (const raw of [undefined, '', '  '])
      expect(reconcileIntervalMs(raw)).toBe(6 * 60 * 60 * 1000);
  });

  it('accepts a positive number of hours, including fractions', () => {
    expect(reconcileIntervalMs('1')).toBe(3_600_000);
    expect(reconcileIntervalMs('0.5')).toBe(1_800_000);
  });

  it('caps at what a timer can hold, and refuses nonsense at startup', () => {
    expect(reconcileIntervalMs('100000')).toBe(2 ** 31 - 1);
    for (const raw of ['0', '-1', 'abc', 'Infinity', 'NaN'])
      expect(() => reconcileIntervalMs(raw), raw).toThrow(/positive number/);
  });
});
