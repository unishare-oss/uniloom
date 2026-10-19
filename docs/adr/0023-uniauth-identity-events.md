# ADR-0023: Uniloom applies uniAuth identity events by version, with a feed as the safety net

Status: Proposed

## Context

uniAuth now delivers versioned identity events (`identity.updated`, `.suspended`, `.reactivated`, `.deleted`) to a
machine client's `identity_events_uri`, at least once and possibly out of order, and serves a change feed
(`/api/directory/v1/users/changes`) for recovery. The older `user-updated` / `user-deleted` notices stay until
uniAuth stops sending them to Uniloom.

## Decision

- `POST /api/uniauth/identity-events` verifies the signed JWT (uniAuth keys, issuer, audience = Uniloom's machine
  client, plus `UNIAUTH_EVENTS_EXTRA_AUDIENCES` during a credential rotation), then applies the event. The event has
  no profile: an update is fetched from the directory first.
- The event id is stored with the change in one transaction (`identity_event_receipt`), so a redelivery changes
  nothing. A user holds `identityVersion`; an event applies only if its version is higher. A suspended person
  (`identityStatus`) loses their sessions and is refused by `requireSession` and the MCP guard; reactivation lets
  them back but does not restore sessions. Deletion keeps the existing behavior (the user and what cascades from them
  go), and an older update after it cannot bring them back. Events about people Uniloom has never seen are
  acknowledged and ignored: an event never creates a user.
- Answers: 204 when done, duplicate, stale or ignored; 401 for a token it cannot verify (uniAuth retries); 400 for a
  verified token it cannot use (final); 503 when the profile could not be fetched (uniAuth retries).
- `reconcileIdentities` reads the change feed from a stored cursor at startup and every `UNIAUTH_RECONCILE_HOURS`
  (default 6). If uniAuth answers 410 (cursor older than its 7-day retention) every linked account is refreshed with
  batch reads and the feed is read again from the start.

- The row is locked (`SELECT … FOR UPDATE`) while an event or resync is applied, so two changes for one person run one after
  the other and an older one cannot overwrite a newer one. The version stored for an update is the directory's if newer than
  the event's; a directory read older than the event is not yet consistent (503, retried; reconciliation stops before it).
  A deleted account (a tombstone read or a resync result) is the existing deletion.
- Reconciliation skips, logs and counts (`skipped`) a malformed entry or a profile it cannot read, so one bad entry cannot
  wedge the cursor; only a lagging directory stops it. Receipts older than 14 days are pruned. `UNIAUTH_RECONCILE_HOURS` is
  validated at startup (positive, capped to a timer's range), and a run never overlaps the previous one.

## Consequences

Events can arrive late, twice or never and Uniloom still converges. The cost is two columns on `user`, two small
tables, and a periodic call to uniAuth. Uniloom still needs the machine credential (`UNIAUTH_DIRECTORY_CLIENT_*`).
