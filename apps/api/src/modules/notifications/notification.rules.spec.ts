import { retryDelay } from './notification.rules.js';

it('backs off failed processing exponentially to a five-minute cap', () => {
  expect(retryDelay(1)).toBe(5_000);
  expect(retryDelay(2)).toBe(10_000);
  expect(retryDelay(6)).toBe(160_000);
  expect(retryDelay(7)).toBe(300_000);
  expect(retryDelay(10)).toBe(300_000);
});
