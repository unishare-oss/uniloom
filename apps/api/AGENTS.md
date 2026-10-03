# API App Guide

## Scope and Folder Structure

This is the Hono API, run directly by Bun. It will serve the REST API, Better Auth
and the MCP endpoint (`/mcp`).

```text
apps/api/
├── prisma/
│   ├── schema.prisma      # Canonical data model
│   └── migrations/        # Database history
├── src/
│   ├── routes/            # One Hono router per area, mounted in app.ts
│   ├── generated/prisma/  # Generated client; never edit manually
│   ├── app.ts             # createApp(): builds the Hono app and mounts routers
│   ├── db.ts              # Prisma client and database connection
│   └── index.ts           # Bun server entry
├── test/                  # End-to-end tests
└── AGENTS.md
```

Put each area's routes in `src/routes/<area>.ts` as a `Hono` router and mount it in
`createApp()`. Keep business logic in plain functions next to the routes or in
`src/<area>/` once an area needs more than one file. Put new routes under `/api/`.
`createApp()` must stay free of side effects so tests can call `app.request()`.

## Responsibilities

- Route handlers parse request data, read the signed-in user, and shape responses.
- Plain functions enforce business and authorization rules. Workflow rules (modes,
  switches, checklist limits, design approval) live in one place and are called by
  both REST routes and MCP tools.
- Call Prisma from those functions. Add a separate data-access layer only when it
  carries real responsibility. Do not add empty pass-through layers.
- Keep Uniloom-specific roles and permissions in this API, not in uniAuth.

## Data and Verification

- Change `prisma/schema.prisma` and add a migration for schema changes. Regenerate
  the Prisma client; never edit `src/generated/prisma` or an applied migration.
- Keep tests close to behavior under `src/` (`*.spec.ts`); use `test/` for end-to-end
  checks against the database (`*.e2e-spec.ts`).
- Run focused checks with `bun run --cwd apps/api typecheck`, `lint`, `test`, and
  `test:e2e` as appropriate. Run `bun run --cwd apps/api build` for structural changes.
- Use `apps/api/.env.example` as the configuration reference. Never commit secrets.
