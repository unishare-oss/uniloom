# ADR-0019: A spec may name one source proposal

Status: Proposed
Date: 2026-10-15

## Context

The user wants proposal-to-spec provenance in Uniloom. Currently proposals can be
linked to tickets, and specs can reference them in Markdown, but the document model
has no typed relationship. A proposal may produce several specs, while small fixes
should remain able to have independent specs.

## Options

1. Keep manual Markdown references only.
2. Add one optional source-proposal foreign key to each spec, with reverse derived specs.
3. Introduce a generic many-to-many document relationship/dependency system.

## Decision

The user chose the optional "Based on proposal" feature with one proposal supporting
multiple specs. I propose option 2 in the existing document table: indexed nullable
`sourceProposalId`, a named self-relation and `onDelete: SetNull`.

Only SPEC may name a source; it must be a same-project Knowledge PROPOSAL. Existing
spec edit permissions govern writes, with no requirement to edit the proposal.
Both project modes may use Knowledge provenance; ticket-owned specs keep existing
Guided-only rules. No proposal approval or ticket state gate is added.

I propose retaining existing provenance when its proposal is archived, while
refusing new assignments to archived proposals. Users may clear or replace a source.
The spec page shows its source; the proposal page shows derived spec summaries,
excluding specs on soft-deleted tickets. No content is copied or synchronized.

## Consequences

- One FK models the agreed cardinality without a generic document graph.
- Existing specs remain independent; no backfill or workflow migration is required.
- Shared API validation must enforce kind and project rules; a foreign key alone
  does not express those restrictions.
- Archived sources remain useful historical context without becoming new choices.
- Supporting several source proposals per spec would require a later scoped change.
- This records provenance only, without approval inheritance, revision snapshots
  or automatic changes to ticket/document links.
