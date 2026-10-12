# TD-012: Creating an item straight into a gated state skips the checklist gate

Status: Open
Found: 2026-10-12, in plan 34

## Problem

`createProjectItem` accepts a `stateId` and only checks that the state belongs to the
project. It doesn't run the move rules, so an Owner or Manager can create an item directly
in In Review (or Done) through `POST /api/projects/:projectId/items`, skipping the
checklist gate that `moveItem` enforces.

## Why it was left

Only Owners and Managers can create items, and they may move to Done anyway; the web app
always creates in the first state. MCP is not affected: `save_item` creates in the first
state and then moves through `moveItem`.

## Fix

In `createProjectItem`, refuse a `stateId` whose key is `in_review` or whose category is
`DONE` (or run `itemRules.checklistError` on the empty checklist), with the same
`criteria_incomplete` error as a move.
