# TD-011: Some item changes leave no activity row

Status: Open
Found: 2026-10-12, in plan 36

## Problem

Plan 36 records the item and checklist writes it lists. Three changes still happen
without a row:

- A feature that moves to Done by itself when its last slice finishes (`finishFeature`
  in `item.service.ts`): only the slice's move is recorded.
- Changing only the evidence of an already ticked entry, and reordering the checklist.
- Label changes and blocked-by links (left out of the plan on purpose).

An item update that only changes labels also records nothing.

- An update's `from` values come from the item read before the transaction, and the item
  is locked only when labels are sent, so two edits of the same field at the same moment
  can each record a `from` the other had already replaced. The data itself is right.

## Why it was left

The plan names exactly which writes are recorded; each gap needs a new action in the
`activitySchema` union and a decision on how it reads in the history.

## Fix

Add an action per gap (`item.move` by the system for the automatic feature move,
`checklist.evidence`, `checklist.reorder`, `item.labels`, `item.blocker.add` and
`.remove`) and write it in the same transaction as the change.
