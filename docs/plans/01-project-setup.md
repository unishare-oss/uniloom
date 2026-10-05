# 01: Project setup

Status: In Review

## Scope

Bun workspace with a Hono API and a Next.js web app, PostgreSQL through Prisma, lint,
tests, CI and Docker. Same tooling as Unigym. No models, auth or MCP yet (slices 2, 4, 5).

## Done when

- [x] `bun run dev` starts the API on 3011 and the web app on 3013; `/api/health` is `ok`
- [x] `bun run lint`, `typecheck`, `test` and `build` pass, and the pre-commit hook runs them
- [x] CI runs install, migrations, lint, typecheck, unit and e2e tests, build, and both Docker builds
- [ ] `bun run up` starts db, migrate, api and web in Docker, and the e2e test reaches PostgreSQL

## Design

| Function            | File                            | What                                        | Why                                                               |
| ------------------- | ------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `createApp(): Hono` | `apps/api/src/app.ts`           | Builds the app and mounts routers           | Tests call `app.request()` without starting a server              |
| `health`            | `apps/api/src/routes/health.ts` | Returns `ok` at `/health` and `/api/health` | Liveness for Docker and the cluster, and a check of the web proxy |
| `prisma`            | `apps/api/src/db.ts`            | Prisma client over `@prisma/adapter-pg`     | One database connection for every area                            |

Follows [ADR-0001](../adr/0001-hono-over-nest.md) and [ADR-0002](../adr/0002-prisma-over-drizzle.md).

## Changes

- `2576609` chore: project setup with Bun, Hono, Next.js and Prisma.
- The last item is open: Docker was not running, so the stack and the e2e test have not run yet.
