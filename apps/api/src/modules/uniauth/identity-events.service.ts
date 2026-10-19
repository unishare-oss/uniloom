import type { DirectoryIdentity } from './directory.client.js';
import {
  batchIdentities,
  fetchChanges,
  readIdentity,
  ResyncRequired,
} from './directory.client.js';
import type { IdentityEvent } from './identity-event-token.js';
import * as uniauthRepo from './uniauth.repository.js';

export type EventOutcome = 'applied' | 'duplicate' | 'stale' | 'ignored';

/**
 * Applies a v1 identity event to the local user. The event carries no profile: an update fetches it from uniAuth's
 * directory first (outside any transaction; if uniAuth cannot answer this throws a 503 so uniAuth retries the event
 * instead of it being acknowledged unapplied). Unknown people are acknowledged and ignored, never created from an event.
 * Unknown future event types are acknowledged too.
 *
 * - identity.updated: refresh name, email and avatar (and status) from the directory.
 * - identity.suspended: block the person at once and end their sessions.
 * - identity.reactivated: allow them again (old sessions are not restored).
 * - identity.deleted: the existing deletion behavior, unchanged: the user and everything that cascades from them go.
 */
export const applyIdentityEvent = async (
  event: IdentityEvent,
  profile?: DirectoryIdentity | null,
): Promise<EventOutcome> => {
  const userId = await uniauthRepo.findUserIdBySub(event.subject);
  if (!userId) return 'ignored';
  let change: uniauthRepo.IdentityChange;
  if (event.type === 'identity.suspended') change = { kind: 'suspend' };
  else if (event.type === 'identity.reactivated')
    change = { kind: 'reactivate' };
  else if (event.type === 'identity.deleted') change = { kind: 'delete' };
  else if (event.type === 'identity.updated') {
    const current =
      profile === undefined ? await readIdentity(event.subject) : profile;
    if (!current) return 'ignored';
    change =
      current.status === 'deleted'
        ? { kind: 'delete' }
        : { kind: 'profile', profile: current };
  } else return 'ignored';
  const outcome = await uniauthRepo.recordAndApply(
    {
      eventId: event.eventId,
      type: event.type,
      subject: event.subject,
      identityVersion: event.identityVersion,
    },
    userId,
    change,
  );
  return outcome === 'gone' ? 'ignored' : outcome;
};

const PAGE = 100;

/**
 * Starts reconciling now and every UNIAUTH_RECONCILE_HOURS (default 6). A failure is logged and retried at the next
 * tick: the event receiver and the feed back each other up. Does nothing when the directory credentials are not set.
 */
export const startIdentityReconcile = (enabled: boolean) => {
  if (!enabled) return () => undefined;
  const hours = Number(process.env.UNIAUTH_RECONCILE_HOURS ?? 6);
  const run = () =>
    reconcileIdentities().catch((error: unknown) => {
      console.error('[uniauth] reconciliation failed:', String(error));
    });
  void run();
  const timer = setInterval(run, hours * 60 * 60 * 1000);
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
      if (result?.result === 'deleted')
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

/**
 * Catches up with uniAuth's change feed from the stored cursor, a page at a time (the cursor is saved after each
 * page, so a failure resumes where it stopped). The feed only covers recent changes; when the cursor is older than
 * uniAuth's retention (410) every known account is refreshed with batch reads and the feed is read again from the
 * start (events already applied are skipped by their id, newer-version rule). Run at startup and periodically, so an
 * app that was offline, or a delivery that exhausted its retries, converges anyway.
 */
export const reconcileIdentities = async () => {
  let cursor = await uniauthRepo.readReconcileCursor();
  let applied = 0;
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
    const ids = [...new Set(page.changes.map((c) => c.id))];
    const known = new Set<string>();
    for (const id of ids)
      if (await uniauthRepo.findUserIdBySub(id)) known.add(id);
    // One batch read for the profiles of this page's updates.
    const profiles = known.size ? await batchIdentities([...known]) : new Map();
    for (const change of page.changes) {
      if (!known.has(change.id)) continue;
      const entry = profiles.get(change.id);
      const profile: DirectoryIdentity | null | undefined =
        entry?.result === 'deleted'
          ? ({ id: change.id, status: 'deleted' } as DirectoryIdentity)
          : (entry?.identity ?? null);
      const outcome = await applyIdentityEvent(
        {
          eventId: change.eventId,
          type: change.type,
          subject: change.id,
          identityVersion: change.version,
        },
        profile,
      );
      if (outcome === 'applied') applied++;
    }
    cursor = page.cursor;
    await uniauthRepo.saveReconcileCursor(cursor);
    if (!page.hasMore) return { applied, resynced };
  }
};
