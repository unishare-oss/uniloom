# TD-015: A Member's edit racing a reassignment

Status: Open
Found: 2026-10-13, in plan 37

## Problem

`updateProjectItem`, the checklist calls and the blocker calls check `mayEdit` against the
assignee read by `loadItem`, outside the transaction and without a lock. If a manager
reassigns the ticket while a Member's edit is in flight, the edit can still be saved after
the ticket stopped being theirs. `moveItem` re-reads under a lock for this case; edits don't.

## Why it was left

The window is a few milliseconds, the edit is recorded in the activity log, and the claim
check has the same gap (TD-004). Locking every edit adds a row lock to the hottest path for
a case small teams won't hit.

## Fix

Inside each transaction, lock the item (`itemRepo.lockItem`), re-read `assigneeId` and
check `mayEdit` again before writing, as `moveItem` does.
