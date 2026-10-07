# ADR-0009: Module types and utils in their own files

Status: Proposed
Date: 2026-10-06

## Context

[ADR-0004](0004-api-feature-modules.md) splits a feature into routes, handlers, service,
repository and schema. Types and small helpers ended up inside service files
(`toItem`, `toListRow` and the row types in `item.service.ts`, `view` in
`member.service.ts`, `toMe` in `user.service.ts`) or next to unrelated code
(`PresetState`, `UniauthEvent`). Services mixed workflows with formatting, which made them
long to read.

## Decision

Amends ADR-0004. A module may add:

- `<feature>.types.ts`: every `type` and `interface` the module declares (row types,
  shapes). Zod schemas stay in `<feature>.schema.ts`.
- `<feature>.utils.ts`: helpers, meaning small pure functions with no database and no
  HTTP: mappers from a row to a response, formatting, small calculations.
- `<feature>.rules.ts` is the rules engine file where a module has one
  (`items/item.rules.ts`).

Workflows that call repositories or run transactions stay in the service, and Prisma
queries stay in the repository. A module with no types or helpers gets no file.

Code used by three or more modules goes to `src/utils/` (functions, one file per topic,
no `index.ts`) or `src/types/` (types). Code used by one or two modules stays in a
module. The same helper written three times in different modules is merged into one
central copy. `http.ts`, `db/`, `auth/` and `openapi.ts` stay where they are.

## Consequences

- Services read as workflows; mappers and types are easy to find.
- More files per module, each with one job. Nothing is central yet: no helper or type is
  used by three modules today.
- A helper that grows a database call or an HTTP dependency must move back to the service
  or repository.
