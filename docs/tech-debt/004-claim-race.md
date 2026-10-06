# TD-004: Two people claiming the same free ticket at once

Status: Open
Found: 2026-10-05, in plan 10

## Problem

A Member may claim a ticket only while it has no assignee. `updateProjectItem` reads the
ticket, checks `mayAssign` (it's free), then writes. If two Members claim the same free
ticket at the same moment, both read it as free, both pass, and the second write wins: the
first person thinks they have it but doesn't.

## Why it was left

Plan 10 keeps the claim as a plain update, like every other field. Teams are small, and
the board shows the real assignee right after, so a lost claim is noticed quickly.

## Fix

Make the claim a conditional update: `updateMany({ where: { id, assigneeId: null }, data:
{ assigneeId } })`, and answer `409 already_claimed` when it updates 0 rows. No lock needed.
