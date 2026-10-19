const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 20;

/** When each person's recent add-by-email lookups happened. */
const lookups = new Map<string, number[]>();

/**
 * Counts one add-by-email lookup for `userId`. False once they have made 20 in the last hour:
 * every lookup tells them whether an email has an account, so it is not unlimited. Kept in
 * memory, so each API instance counts on its own.
 */
export const takeLookup = (userId: string, now = Date.now()) => {
  const recent = (lookups.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    lookups.set(userId, recent);
    return false;
  }
  lookups.set(userId, [...recent, now]);
  return true;
};

/** For tests. */
export const resetLookups = () => {
  lookups.clear();
};
