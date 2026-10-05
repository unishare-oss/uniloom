# TD-002: A child created while its parent is being deleted can point at a hidden parent

Status: Open
Found: 2026-10-04, in plan 04 (Items), by the independent review

## Problem

`removeItem` counts the item's live children and then soft-deletes it, outside a
transaction. Creating an item under that parent, or moving one to it, checks the parent
(`checkParent`) before writing, also outside a lock. If the two run at the same moment,
both checks can pass: the parent ends up deleted while a live child still points at it.
That child then has a `parentId` that answers 404, which plan 04 says should never happen.

## Why it was left

It needs a create or move under a parent at the same instant that parent is deleted:
much rarer than the blocked-by race (fixed with a workspace lock in plan 04). A proper fix
touches three paths (create, update with `parentId`, delete), so it was left out to keep
plan 04 small.

## Fix

Do the parent check and the write in one transaction that locks the workspace row (as
`createItem` and `createLinkChecked` already do), in `createItem`, in `updateItem` when
`parentId` changes, and in the soft delete: re-read that the parent is live, or that
there are no live children, inside the lock. Add an e2e test that runs a delete and a
create under the same parent concurrently and expects one of them to be refused.
