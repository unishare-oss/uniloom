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

| Path                               | Purpose                                         |
| ---------------------------------- | ----------------------------------------------- |
| `apps/web`                         | Next.js App Router, Tailwind CSS, shadcn/ui     |
| `apps/api`                         | Hono on Bun, Prisma schema and migrations       |
| `skill`                            | Agent skill files, written after the MCP server |
| `docker-compose.yml`               | PostgreSQL, migrations, API and web in Docker   |
| `.github/workflows/`               | CI, image builds, release (see below)           |
| `Dockerfile.api`, `Dockerfile.web` | Production images for the API and web app       |

Add models to `apps/api/prisma/schema.prisma` as slices need them, then create a migration with `bun run db:migrate`.

## Checks

```sh
bun run lint
bun run typecheck
bun run test
bun run --cwd apps/api test:e2e
bun run build
```

The Git pre-commit hook formats staged files and runs lint and typecheck; the commit-msg hook checks [Conventional Commits](https://www.conventionalcommits.org) with commitlint. `bun install` installs both hooks in a Git checkout.

## Branches, CI and releases

Work goes into `dev` through pull requests; `dev` is merged into `main` to release. The pipeline follows Unishare's:

| Workflow                    | When                        | What                                                                                                                                                                                                        |
| --------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                    | push and PR to `main`/`dev` | Install, migrations, lint, typecheck, unit and e2e tests, build                                                                                                                                             |
| `docker.yml`                | push to `main`/`dev`        | Builds only the changed images on native `linux/arm64` runners and pushes them to GHCR: `latest` + `sha-<commit>` from `main`, `dev` + `sha-<commit>-dev` from `dev`. Then writes the tag to `k8s-practice` |
| `release.yml`               | after images on `main`      | semantic-release: version, `CHANGELOG.md`, GitHub release, and `v<version>` image tags                                                                                                                      |
| `dependabot-auto-merge.yml` | Dependabot PRs to `main`    | Approves and auto-merges weekly dependency updates                                                                                                                                                          |
| `codeql.yml`                | by hand                     | CodeQL analysis                                                                                                                                                                                             |

Repository settings the pipeline reads:

- Secrets `APP_ID`, `APP_PRIVATE_KEY`: the release bot. Without them the release is skipped.
- Secrets `GITOPS_APP_ID`, `GITOPS_APP_PRIVATE_KEY`, and variables `GITOPS_VALUES_FILE` (main) / `GITOPS_VALUES_FILE_DEV` (dev): the values file in `k8s-practice` to write image tags into. Without the variable the deploy step is skipped.
- Variables `API_URL` / `DEV_API_URL`: baked into the web image. Without them the Dockerfile defaults are used.
