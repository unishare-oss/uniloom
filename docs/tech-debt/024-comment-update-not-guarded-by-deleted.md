# TD-024: Comment edit and delete can race a concurrent delete

Status: Open
Found: 2026-10-16, in plan 52

## Problem

`updateComment` and `deleteComment` check the comment is live with `findLiveComment`, then
write with `updateCommentRow`, whose `where` is only `{ id }`. A PATCH that races a DELETE can
write a new body onto a row that was just deleted, and two DELETEs can both set `deletedAt`.

## Why it was left

The tree blanks deleted rows on read, so nobody sees the stray body or the second timestamp.
Guarding the write with `deletedAt: null` throws Prisma's P2025, which the API doesn't map to
`not_found` yet, so it would turn a harmless race into a 500.

## Fix

Add `deletedAt: null` to the update's `where` and map P2025 to `404 not_found`, or use
`updateMany` and treat a count of 0 as `not_found`.
