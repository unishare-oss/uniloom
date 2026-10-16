# ADR-0021: One Comment table for tickets and documents

Status: Proposed
Date: 2026-10-16

## Context

MVP §4 promises a comment thread per ticket. On 2026-10-16 the user asked for comments
on tickets and on documents, ported from Unishare's comment system: nested replies, soft
delete, author-only edit. Uniloom already keeps ticket-owned records as documents
(ADR-0014), so both targets need the same thread behaviour.

## Options

1. **Two tables** (`ItemComment`, `DocumentComment`). Real foreign keys, but every query,
   rule and component exists twice.
2. **One table with a generic target** (`targetType` + `targetId`). One copy of the code,
   but no foreign keys, so deleted targets and wrong projects are not enforced.
3. **One table with two nullable foreign keys.** `itemId?` and `documentId?`, plus a CHECK
   constraint that exactly one is set. One copy of the code, and both keys are real.

## Decision

Option 3. `Comment` has `projectId`, `itemId?`, `documentId?`, `parentId?` (self relation
for nesting), `authorId`, `body`, `editedAt?`, `deletedAt?` and `createdAt`. The migration
adds the CHECK constraint `comment_one_target`. A reply must be on the same target as its
parent; the service checks this.

Comments are soft-deleted. A deleted comment stays in the tree as a placeholder, so its
replies keep their place. "Edited" comes from `editedAt`, not `updatedAt`, so a delete
never shows as an edit.

## Consequences

- One service, one rules file and one set of web components serve both targets.
- Adding a third target (e.g. a project-level thread) means another nullable key and a
  wider CHECK constraint.
- Reads go through the target's own membership-checked load (`loadItem`, the document
  read), so soft-deleted tickets and deleted projects hide their comments for free.
