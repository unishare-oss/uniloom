# ADR-0002: Prisma for the database, not Drizzle

Status: Accepted
Date: 2026-10-03

## Context

Agents write most of the code and people review it. The database is PostgreSQL. The
spec first leaned to Drizzle and listed Prisma as the alternative (MVP open question 3).

## Options

- **Drizzle.** Schema in TypeScript, no generate step, queries close to SQL, more
  Postgres features in the schema.
- **Prisma 7.** Familiar from Unigym. No native engine since v7; runs on Bun through
  `@prisma/adapter-pg`. Mature migrations and a readable schema.

## Decision

Prisma 7 with `@prisma/adapter-pg`.

## Consequences

- Data code is easy to review because it is familiar.
- A `prisma generate` step runs in dev, CI and Docker builds.
- Postgres-only features (such as partial unique indexes) go into migrations as raw
  SQL.
