import type { DirectoryIdentity } from './directory.client.js';
import {
  batchIdentities,
  fetchChanges,
  readIdentity,
  ResyncRequired,
  type DirectoryChange,
} from './directory.client.js';
import type { IdentityEvent } from './identity-event-token.js';
import * as uniauthRepo from './uniauth.repository.js';

export type EventOutcome = 'applied' | 'duplicate' | 'stale' | 'ignored';

/**
 * The directory's answer is older than the event that asked for it (a lagging read): applying it would record a version
 * the event has already passed. The receiver answers 503 so uniAuth retries; reconciliation stops before that page.
 */
export class NotYetConsistent extends Error {}

/**
 * Applies a v1 identity event to the local user. The event carries no profile: an update fetches it from uniAuth's
 * directory first (outside any transaction; if uniAuth cannot answer this throws a 503 so uniAuth retries the event
 * instead of it being acknowledged unapplied). Unknown people are acknowledged and ignored, never created from an event.
 * Unknown future event types are acknowledged too.
 *
 * - identity.updated: refresh name, email and avatar (and status) from the directory. The version stored is the
 *   directory's if it is newer than the event's (it can be: the profile is read now); if it is OLDER, the read is not yet
 *   consistent with the event and NotYetConsistent is thrown.
 * - identity.suspended: block the person at once and end their sessions.
 * - identity.reactivated: allow them again (old sessions are not restored).
 * - identity.deleted: the existing deletion behavior, unchanged: the user and everything that cascades from them go.
 *
 * `known` lets reconciliation pass what it already looked up (the profile, the local user id) instead of asking again.
 */
export const applyIdentityEvent = async (
  event: IdentityEvent,
  known: { profile?: DirectoryIdentity | null; userId?: string } = {},
): Promise<EventOutcome> => {
  const userId =
    known.userId ?? (await uniauthRepo.findUserIdBySub(event.subject));
  if (!userId) return 'ignored';
  let change: uniauthRepo.IdentityChange;
  let version = event.identityVersion;
  if (event.type === 'identity.suspended') change = { kind: 'suspend' };
  else if (event.type === 'identity.reactivated')
    change = { kind: 'reactivate' };
  else if (event.type === 'identity.deleted') change = { kind: 'delete' };
  else if (event.type === 'identity.updated') {
    const current =
      known.profile === undefined
        ? await readIdentity(event.subject)
        : known.profile;
    if (!current) return 'ignored';
    if (current.status === 'deleted') change = { kind: 'delete' };
    else {
      if (current.version < event.identityVersion) throw new NotYetConsistent();
      version = current.version;
      change = { kind: 'profile', profile: current };
    }
  } else return 'ignored';

  let outcome;
  try {
    outcome = await uniauthRepo.recordAndApply(event, userId, change, version);
  } catch (error) {
    // The new email was taken by another user between the check and the write: keep the old one, apply the rest.
    if (change.kind !== 'profile' || !uniauthRepo.isUniqueViolation(error))
      throw error;
    outcome = await uniauthRepo.recordAndApply(
      event,
      userId,
      { ...change, skipEmail: true },
      version,
    );
  }
  return outcome === 'gone' ? 'ignored' : outcome;
};

const PAGE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
/** setInterval cannot take more than a signed 32-bit number of milliseconds. */
const MAX_INTERVAL_MS = 2 ** 31 - 1;
/** Receipts only dedupe redeliveries, which stop within uniAuth's 72 h window. */
const RECEIPT_RETENTION_MS = 14 * DAY_MS;

/**
 * UNIAUTH_RECONCILE_HOURS as milliseconds: empty means the default of 6 hours; otherwise it must be a positive number
 * (a mistake is a startup error, not a timer that fires every millisecond or never), capped at what a timer can hold.
 */
export const reconcileIntervalMs = (raw: string | undefined) => {
  if (raw === undefined || raw.trim() === '') return 6 * 60 * 60 * 1000;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0)
    throw new Error(
      `UNIAUTH_RECONCILE_HOURS must be a positive number, got: ${raw}`,
    );
  return Math.min(Math.round(hours * 60 * 60 * 1000), MAX_INTERVAL_MS);
};

/**
 * Starts reconciling now and every UNIAUTH_RECONCILE_HOURS (default 6). A run never starts while the previous one is
 * still going; a failure is logged and retried at the next tick (the event receiver and the feed back each other up).
 * Does nothing when the directory credentials are not set.
 */
export const startIdentityReconcile = (enabled: boolean) => {
  if (!enabled) return () => undefined;
  const interval = reconcileIntervalMs(process.env.UNIAUTH_RECONCILE_HOURS);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await reconcileIdentities();
    } catch (error) {
      console.error('[uniauth] reconciliation failed:', String(error));
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), interval);
  timer.unref();
  return () => clearInterval(timer);
};

/** Refreshes every locally known uniAuth account from batch reads (the recovery when the change feed no longer reaches back). */
export const resyncKnownIdentities = async () => {
  let after: string | null = null;
  let refreshed = 0;
  for (;;) {
    const accounts = await uniauthRepo.listLinkedSubs(after, PAGE);
    if (!accounts.length) return refreshed;
    const results = await batchIdentities(accounts.map((a) => a.accountId));
    for (const { accountId, userId } of accounts) {
      const result = results.get(accountId);
      // A deleted account answers as `deleted` (or, defensively, as a found tombstone): both are the existing deletion.
      if (
        result?.result === 'deleted' ||
        result?.identity?.status === 'deleted'
      )
        await uniauthRepo.applyResync(userId, 'deleted');
      else if (result?.result === 'found' && result.identity) {
        if (
          (await uniauthRepo.applyResync(userId, result.identity)) === 'applied'
        )
          refreshed++;
      }
    }
    after = accounts.at(-1)!.accountId;
  }
};

const isChange = (c: Partial<DirectoryChange> | null): c is DirectoryChange =>
  !!c &&
  typeof c.eventId === 'string' &&
  typeof c.type === 'string' &&
  typeof c.id === 'string' &&
  Number.isInteger(c.version);

/**
 * Catches up with uniAuth's change feed from the stored cursor, a page at a time (the cursor is saved after each
 * page, so a failure resumes where it stopped). The feed only covers recent changes; when the cursor is older than
 * uniAuth's retention (410) every known account is refreshed with batch reads and the feed is read again from the
 * start (events already applied are skipped by their id, newer-version rule). Run at startup and periodically, so an
 * app that was offline, or a delivery that exhausted its retries, converges anyway.
 *
 * One bad entry must not wedge the feed. The choice made here: an entry that is malformed, or whose profile cannot be
 * read for a person we know, is SKIPPED, logged, and counted in `skipped` (the cursor moves on; the next event for that
 * person or the 410 resync repairs it). A transient inconsistency (the directory is behind the change) is different:
 * reconciliation STOPS before that page without saving its cursor and the next run retries it.
 */
export const reconcileIdentities = async () => {
  await uniauthRepo.pruneReceipts(RECEIPT_RETENTION_MS);
  let cursor = await uniauthRepo.readReconcileCursor();
  let applied = 0;
  let skipped = 0;
  let resynced = false;
  for (;;) {
    let page;
    try {
      page = await fetchChanges(cursor, PAGE);
    } catch (error) {
      if (!(error instanceof ResyncRequired) || resynced) throw error;
      await resyncKnownIdentities();
      resynced = true;
      cursor = null;
      await uniauthRepo.saveReconcileCursor(null);
      continue;
    }
    const changes = page.changes.filter((c) => {
      if (isChange(c)) return true;
      skipped++;
      console.warn(
        '[uniauth] skipped a malformed change entry:',
        JSON.stringify(c),
      );
      return false;
    });
    // One query for who we know, one batch read for the profiles of this page's updates.
    const users = await uniauthRepo.findUserIdsBySubs([
      ...new Set(changes.map((c) => c.id)),
    ]);
    const updated = [
      ...new Set(
        changes
          .filter((c) => c.type === 'identity.updated' && users.has(c.id))
          .map((c) => c.id),
      ),
    ];
    const profiles = updated.length
      ? await batchIdentities(updated)
      : new Map();
    for (const change of changes) {
      const userId = users.get(change.id);
      if (!userId) continue;
      let profile: DirectoryIdentity | null | undefined;
      if (change.type === 'identity.updated') {
        const entry = profiles.get(change.id);
        profile = entry?.identity ?? null;
        if (!profile) {
          skipped++;
          console.warn(
            `[uniauth] skipped ${change.eventId}: no profile for ${change.id} (${entry?.result ?? 'missing'})`,
          );
          continue;
        }
      }
      try {
        const outcome = await applyIdentityEvent(
          {
            eventId: change.eventId,
            type: change.type,
            subject: change.id,
            identityVersion: change.version,
          },
          { profile, userId },
        );
        if (outcome === 'applied') applied++;
      } catch (error) {
        if (error instanceof NotYetConsistent) {
          console.warn(
            '[uniauth] the directory is behind the feed; stopping before this page',
          );
          return { applied, resynced, skipped, stopped: true };
        }
        throw error;
      }
    }
    cursor = page.cursor;
    await uniauthRepo.saveReconcileCursor(cursor);
    if (!page.hasMore) return { applied, resynced, skipped, stopped: false };
  }
};
