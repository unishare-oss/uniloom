# Uniloom

Bun monorepo with a Next.js web app, a Hono API, Tailwind CSS, shadcn/ui, Prisma, and PostgreSQL. Uniloom is a self-hosted work tracker for building software with a coding agent; see [`MVP.md`](MVP.md) for the spec and build order.

## Start locally

Requirements: Bun 1.4.2 and Docker. PostgreSQL runs in Docker; the web and API apps run with Bun.

```sh
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
bun run db:up
bun run db:generate
bun run db:migrate
bun run dev
```

Open <http://127.0.0.1:3013>. The API health endpoint is <http://localhost:3011/health>. `bun run db:up` starts PostgreSQL from `docker-compose.yml` on `127.0.0.1:5434` (Unigym uses `5433`) and waits until it is healthy. Stop it with `bun run db:down`; the data stays in the `postgres_data` volume.

### Run everything in Docker

```sh
bun run up     # builds the images, starts db → migrate → api → web, waits until healthy
bun run down
```

`migrate` applies Prisma migrations and exits before the API starts. The web app is at <http://127.0.0.1:3013> and the API at <http://localhost:3011>, so stop `bun run dev` first: they use the same ports. Rebuild after code changes with `bun run up` again.

## Structure

| Path                               | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `apps/web`                         | Next.js App Router, Tailwind CSS, shadcn/ui           |
| `apps/api`                         | Hono on Bun, Prisma schema and migrations             |
| `skill`                            | Agent skill files, written after the MCP server       |
| `docker-compose.yml`               | PostgreSQL, migrations, API and web in Docker         |
| `.github/workflows/ci.yml`         | Install, migration, lint, typecheck, tests, and build |
| `.github/workflows/images.yml`     | Build and push `linux/arm64` images to GHCR           |
| `Dockerfile.api`, `Dockerfile.web` | Production images for the API and web app             |

Add models to `apps/api/prisma/schema.prisma` as slices need them, then create a migration with `bun run db:migrate`.

## Checks

```sh
bun run lint
bun run typecheck
bun run test
bun run --cwd apps/api test:e2e
bun run build
```

The Git pre-commit hook formats staged files and runs lint and typecheck. CI also builds both `linux/arm64` Docker images. `bun install` installs it in a Git checkout.
