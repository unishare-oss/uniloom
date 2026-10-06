# ADR-0004: API code in feature modules

Status: Accepted
Date: 2026-10-03

## Context

The API had routers in `src/routes/` and their logic in per-area folders, so one
feature (users) was split across two places. Ten more features are coming, plus a rules
engine and an MCP server that must call the same logic as the REST routes.

## Options

- **Feature modules:** `src/modules/<feature>/` holds the feature's router, service,
  validation and tests. Shared infrastructure (auth, rules, MCP, db) at the top.
- **Layers by kind:** `routes/`, `services/`, `schemas/`, `middleware/`, one file per
  feature in each.
- **Flat feature files:** one file per feature, split into a folder when it grows.

## Decision

Feature modules in `src/modules/<features>/`, each split into
`<feature>.routes.ts` (paths and route middleware), `<feature>.handlers.ts` (HTTP input
and responses, plain `(c: Context)` functions), `<feature>.service.ts` (rules and workflows), `<feature>.repository.ts` (Prisma
queries) and `<feature>.schema.ts` (validation), with tests next to them. A module adds
only the files it needs. Like Unigym's `src/modules/<feature>/`, with plain functions
instead of Nest classes. Only repositories touch the database, importing the Prisma client from
`src/db/`. (Amended by [ADR-0008](0008-services-run-transactions.md): services may
start a transaction and pass `tx` to repository functions.)

## Consequences

- A feature is reviewed and changed in one folder, which suits one plan per feature.
- More files per feature than a single router file, but each has one job, and a design's
  function table maps onto them.
- MCP tools and the rules engine call services directly.
- Auth, rules and MCP stay outside `modules/` because every feature uses them.
