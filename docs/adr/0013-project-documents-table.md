# ADR-0013: Documents are one table owned by the project

Status: Proposed
Date: 2026-10-12

## Context

Plan 15 adds a knowledge library: briefs, proposals, specs and reference notes. MVP §8
describes documents too (change, feature, overview and reference types, attached to items
or features, with revisions and approval). Plan 15 must not become a second store that §8
later has to merge.

## Options

1. **Documents as items** of a new kind. Reuses the item table, but a document has no
   state, assignee or checklist, and would show on the board.
2. **One `Document` table owned by the project.** Plain Markdown with a kind, a purpose and
   an author; no state.
3. **One table per kind.** Four tables for the same columns.

## Decision

Option 2. A `document` row belongs to a project (deleted with it) and has a `DocumentKind`
enum. §8 extends this table with an optional item or feature link, revisions and approval
instead of adding another.

## Consequences

- Documents never appear on the board and have no workflow.
- The kinds `BRIEF`, `PROPOSAL`, `SPEC` and `REFERENCE` may be renamed or merged when §8
  arrives (tech debt 012).
- Permissions reuse the project roles: Owners and Managers create; the author, an Owner or
  a Manager edits.
