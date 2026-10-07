# ADR-0011: Durable review events and recipient notifications

Status: Accepted
Date: 2026-10-07

## Context

The review inbox needs both current actionable work and durable change notifications.
Recipients have independent read state. Repeated review submissions must retain history
while their presentation can be grouped. Notification processing should not delay task
moves when a background process is unavailable.

The user chose all project Owners/Managers as initial recipients and a workflow boundary:
Members cannot move items out of In Review; reviewers can return them for more work.
The user asked for a simple design using the existing stack that can support future
delivery channels. Codex proposed the following storage and processing design; the user authorized
its implementation after the architecture discussion and UI preview.

## Options

1. Save a task move, then create notifications best-effort. Simple, but a crash between
   the writes can lose notification intent.
2. Create every recipient notification in the task transaction. Atomic, but fan-out
   logic and its failures become part of the move request.
3. Save one durable submission event with the move; process recipient notifications
   asynchronously using PostgreSQL and a small Bun worker.
4. Introduce a queue package or broker. Provides broader job tooling, but adds a
   dependency or service beyond the initial in-app requirement.

## Decision

Use option 3, using existing PostgreSQL and Bun. No generic queue framework.

- The move transaction inserts one event for each genuine transition into In Review.
  Recording the event is part of saving the submission. A failed event insert rolls
  back the move; later notification-processing failures do not.
- Keep event body fields append-only and processing metadata mutable. A submission
  event is history, not a substitute for the item's current state.
- Snapshot Owner/Manager recipient ids when the event is recorded, including eligible
  actors. Worker delivery and later reads recheck current review authority.
- One separate worker entry point processes due events with short row-locking transactions.
  Notification insertions and event completion commit together.
- A notification belongs to one recipient and one event; (eventId, recipientId) is unique.
  Group by task for display while preserving individual submission rows.
- Mark explicitly observed notification ids read, leaving new arrivals and other users'
  records unchanged.
- Use current item state for Needs review. Completed/returned work leaves that view,
  while permitted history remains available.
- Add per-channel delivery jobs only when email, push, or webhooks are introduced.
  External network calls must run outside database transactions.

The user authorized the live implementation following the UI preview. Recipient
snapshots and current authority checks follow the previously discussed architecture.
Retry defaults are implementation defaults documented in plan 31. Read/unread
actions operate on explicitly displayed ids, as chosen during the UI refinement.

## Consequences

- A worker outage delays notifications but preserves pending intent.
- The system accepts eventual notification visibility; there is no instant-delivery promise.
- We own a small processing loop, retry policy, failed-event recovery, and its operations.
- Atomic event recording remains a dependency of review submission persistence.
- Row locks and event/recipient uniqueness support additional worker instances.
- New reviewers can see current work without inheriting historical recipient records;
  revoked reviewers cannot use old notifications to retrieve restricted content.
- Event and notification retention needs a later policy before substantial history accumulates.
- Future improvement: task-specific reviewers or configurable subscriptions.
- No email/push implementation, batching window, move rate limiter, or self-notification
  preference is accepted by this ADR.

Related plans: [30](../plans/30-review-boundary-and-events.md),
[31](../plans/31-review-notification-worker.md), and
[14](../plans/14-review-inbox.md). Transaction ownership follows
[ADR-0008](0008-services-run-transactions.md).
