# ADR-0020: Projects are soft-deleted, hidden by the membership lookup

Status: Proposed
Date: 2026-10-16

## Context

Owners need to delete a project (MVP §4). The user wants the delete to be soft, so
data can be recovered, and owner-only, never through MCP. A project owns items,
documents, labels, members, invites and notifications, and many queries reach them.

## Options

1. **Hard delete with cascades.** Simple to query, but nothing can be recovered.
2. **Soft delete, filter every query.** Add `deletedAt: null` to each project-scoped
   query. Easy to miss one, and every new query must remember it.
3. **Soft delete, filter at the membership gate.** `findMember` (behind `requireRole`)
   and the project lookups behind `requireMember` skip deleted projects. Only the few
   queries that do not start from membership (project list, review queue,
   notifications, invite tokens, MCP key lookups) filter on their own.

## Decision

Option 3. Project gets a nullable `deletedAt`. Child rows are left as they are.

## Consequences

- New project-scoped services stay correct as long as they start with `requireRole` or
  `requireMember`, which is already the rule.
- A new query that reads across projects without membership must add
  `project: { deletedAt: null }` itself.
- A deleted project keeps its key prefix, because `keyPrefix` stays globally unique.
- Restore is a database operation for now.
