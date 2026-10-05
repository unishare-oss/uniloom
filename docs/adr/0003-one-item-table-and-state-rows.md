# ADR-0003: One item table, states as rows, UUIDv7 ids

Status: Proposed
Date: 2026-10-03

## Context

The two modes have different item kinds (Feature → Slice in Guided, Project → Task →
Subtask in Standard) and different states (nine fixed in Guided, custom in Standard).
A workspace can switch mode later and keep its data (MVP §3). The spec said "two levels
only" but also listed three Standard levels.

## Options

- **Items:** one `item` table with a `kind` and a `parentId`, or a table per kind.
- **States:** rows per workspace in both modes, or a Postgres enum for Guided and rows
  for Standard.
- **Ids:** UUIDv7 strings, cuid strings, or auto-increment integers.

## Decision

- One `item` table for every kind. Guided allows two levels, Standard three; the rules
  engine enforces the depth, not the database.
- States are rows in both modes. Guided states carry a stable `key` (`ready`,
  `in_review`, `done`, ...) that the rules use; custom Standard states have none. Every
  state has a `category` (backlog, unstarted, started, done, canceled) for boards and for
  closing a feature when all its slices are done.
- Ids are UUIDv7 (`@default(uuid(7)) @db.Uuid`): time-ordered and safe to expose.
  Better Auth's tables keep their own string ids. Human keys like `UG-12` come from
  `workspace.nextItemNumber`, incremented in the item's transaction.
- Tables are added one feature at a time, each with its own migration
  (`docs/plans/02-workspaces.md` lists the order).

## Consequences

- Switching mode is a settings change plus a state mapping, with no data migration.
- Every board, list and rule query has one table and one state model.
- Depth and kind rules are code, so they must be tested in the rules engine (slice 3).
- Ids are 16 bytes, not 4; fine at this scale.
