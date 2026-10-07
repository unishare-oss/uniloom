/** Five seconds initially, capped at five minutes. */
export const retryDelay = (attempts: number) =>
  Math.min(300_000, 5_000 * 2 ** Math.max(0, attempts - 1));
