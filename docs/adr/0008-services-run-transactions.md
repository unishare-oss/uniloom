# ADR-0008: Services run transactions; repositories take `tx`

Status: Proposed
Date: 2026-10-05

## Context

[ADR-0004](0004-api-feature-modules.md) puts rules in `*.service.ts` and says only
`*.repository.ts` touches the database. Two rules have to run inside a transaction with
the project row locked, so a concurrent request can't slip between the check and the
write (a race):

- Blocked-by: no loop of items waiting on each other (`addBlocker`).
- Members: a project always keeps an owner (`changeRole`, `removeMember`).

To keep the rule in the service and the transaction in the repository, the repository
took the rule as a callback (`createLinkChecked(..., check)`, `keepingOwner(..., change)`).
It works, but the order (lock, read, check, write) is split across two files and hidden
behind a function parameter, which makes it hard to read.

## Options

1. **Keep the callbacks.** Follows ADR-0004 to the letter. Hard to read.
2. **Move the rules into the repository.** One file, but rules leave the service layer,
   and MCP tools call services for their rules.
3. **The service runs the transaction** with `prisma.$transaction(async (tx) => ...)` and
   calls small repository functions that take `tx`. The steps read top to bottom in one
   function.

## Decision

Option 3. A service may import `prisma` from `src/db/prisma.ts` only to start a
transaction. Every query still lives in a repository; a repository function that must run
inside a transaction takes `tx` as its first parameter (`lockProject(tx, projectId)`).

## Consequences

- `addBlocker`, `changeRole` and `removeMember` read as lock → read → check → write.
- A new caller has to remember `lockProject`; the comment on each such function says so.
- Amends ADR-0004: "only repositories touch the database" becomes "only repositories
  write queries; services may start a transaction".
