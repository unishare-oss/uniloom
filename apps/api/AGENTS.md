# API App Guide

## Scope and Folder Structure

This is the Hono API, run directly by Bun. It will serve the REST API, Better Auth
and the MCP endpoint (`/mcp`).

```text
apps/api/
├── prisma/
│   ├── schema.prisma        # Canonical data model
│   └── migrations/          # Database history
├── src/
│   ├── modules/             # One folder per feature (see below)
│   │   ├── health/          # health.routes.ts
│   │   ├── users/           # /api/me, consent
│   │   └── uniauth/         # uniAuth receivers and event tokens
│   ├── auth/                # Better Auth (`auth`), session and consent middleware
│   ├── db/                  # prisma.ts: the Prisma client and connection
│   ├── rules/               # Workflow rules engine, shared by REST and MCP (later)
│   ├── mcp/                 # MCP server; its tools call module services (later)
│   ├── generated/prisma/    # Generated client; never edit manually
│   ├── routes/index.ts      # Every /api route in one place: auth, receivers, modules
│   ├── env.ts               # Declares `c.var.user` for every Hono context
│   ├── app.ts               # `app`: health, then mounts routes/index.ts
│   └── index.ts             # Bun server entry
├── test/                    # End-to-end tests and test support
└── AGENTS.md
```

Each feature is a folder `src/modules/<features>/` with files named after the singular
(`users/user.routes.ts`). Add only the files the feature needs:

| File                      | Holds                                                                      |
| ------------------------- | -------------------------------------------------------------------------- |
| `<feature>.routes.ts`     | The `Hono` router, plain Hono style: `userRoutes.get('/me', getMe)`        |
| `<feature>.handlers.ts`   | Plain `(c: Context) => …` functions: read input, call the service, respond |
| `<feature>.service.ts`    | Business rules and workflows; no HTTP                                      |
| `<feature>.repository.ts` | Prisma queries; no rules                                                   |
| `<feature>.schema.ts`     | Request validation (zod), used by the routes                               |
| `*.spec.ts`               | Unit tests next to the code they test                                      |

Import with the `@/` alias (`@/db/prisma.js`, `@/auth/auth.js`) for anything outside the
file's own folder; keep `./` only for files in the same folder.

Calls go routes → handlers → service → repository. Only repositories touch the
database: they import `prisma` from `src/db/prisma.ts`. Handlers read the signed-in user
with `c.var.user` and pass plain values (ids, input) to services. A module may call another
module's service, never its handlers or repository. Mount each module router in
`src/routes/index.ts`, not in `app.ts`. `src/auth/auth.ts` reads its settings when it is
imported: unit tests get placeholders from `vitest.config.ts`, and e2e tests set them
and then import the app (`test/support/test-app.ts`).

`src/routes/index.ts` is the one place that wires `/api` (Express-style index routing).
Health is the only route outside it, in `app.ts`. Better Auth is mounted at
`/api/auth/*`; people sign in through uniAuth only. In the index, routes registered
before `requireSession` are public, routes between `requireSession` and
`requireConsent` need a session only (`/api/me`, consent), and every module router
mounted after `requireConsent` needs both: `401` without a session, `403
consent_required` until the user accepts Uniloom's terms. Mount new feature routers at
the end. Read the signed-in user with `c.var.user`. Map uniAuth people by `sub` through
`account`, never by email.

## Responsibilities

- Handlers parse request data, read the signed-in user, and shape responses.
- Services enforce business and authorization rules. Workflow rules (modes,
  switches, checklist limits, design approval) live in one place and are called by
  both REST routes and MCP tools.
- Repositories own the Prisma queries. Services call repositories, never Prisma
  directly.
- Keep Uniloom-specific roles and permissions in this API, not in uniAuth.

## Data and Verification

- Change `prisma/schema.prisma` and add a migration for schema changes. Regenerate
  the Prisma client; never edit `src/generated/prisma` or an applied migration.
- Keep tests close to behavior under `src/` (`*.spec.ts`); use `test/` for end-to-end
  checks against the database (`*.e2e-spec.ts`).
- Run focused checks with `bun run --cwd apps/api typecheck`, `lint`, `test`, and
  `test:e2e` as appropriate. Run `bun run --cwd apps/api build` for structural changes.
- Use `apps/api/.env.example` as the configuration reference. Never commit secrets.
