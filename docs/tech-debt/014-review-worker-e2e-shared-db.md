# TD-014: Review worker e2e tests race the deployed worker on the dev database

Status: Open
Found: 2026-10-13, in commit 200b139

## Problem

`test/reviews.e2e-spec.ts` calls `processNextReviewEvent()`, which takes the oldest due
event in the whole `review_event` table. Locally the e2e tests run against the dev
database on the Oracle VM, where the `notification-worker` container polls the same
table. When the container takes the test's event first, the test's call skips it
(`FOR UPDATE SKIP LOCKED`) and processes another event or nothing, so the test fails at
random. CI is not affected: it uses its own fresh PostgreSQL with no worker.

## Why it was left

Found while fixing a CI failure in the same test, which came from other test files'
events being older than the retried one. That fix doesn't help locally, because nothing
stops the deployed worker from taking the event.

## Fix

Let the tests process one event by id (e.g. `processReviewEvent(id)`, with the worker
loop calling the same steps), or stop the dev `notification-worker` while running e2e
tests locally.
