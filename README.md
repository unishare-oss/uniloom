# Uniloom

[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.4-000000?logo=bun)](https://bun.sh/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.13-E36002?logo=hono)](https://hono.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-000000?logo=shadcnui)](https://ui.shadcn.com/)
[![Better Auth](https://img.shields.io/badge/Better%20Auth-1.7-black?logo=betterauth)](https://www.better-auth.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)

A self-hosted work tracker for building software with a coding agent: plan work as small slices with done-when checklists, let the agent do the work, and keep the decisions (approving, accepting, finishing) with people.

See [`MVP.md`](MVP.md) for the spec and build order.

---

## Features

- **Projects in two modes** — Standard (your own states) or Guided (locked workflow states for agent-driven work)
- **Items** — features, slices, tasks and subtasks with priority, assignee and blocked-by links
- **Board** — drag items between states, search, and filter by label, assignee or parent item (filters live in the URL)
- **Done-when checklists** — 3–6 items per slice; moves are refused until the checklist allows them
- **Assign and claim** — members claim free tickets themselves, unless the project turns self-claim off
- **Members and roles** — owner, manager and member, each with its own limits
- **Project settings** — switches for the workflow rules and checklist limits
- **Labels** — managers create labels, anyone in the project tags items with them
- **Review inbox** — submissions for review, returns and resubmissions, with a notification worker and per-user history
- **Sign-in** — single sign-on through [uniAuth](https://github.com/unishare-oss/uniAuth) (OpenID Connect)

## Tech Stack

| Layer        | Technology                                                       |
| ------------ | ---------------------------------------------------------------- |
| Frontend     | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui     |
| Backend      | Hono 4 on Bun, Prisma 7, PostgreSQL 17                           |
| Auth         | Better Auth as the OIDC client, uniAuth as the identity provider |
| State        | TanStack Query 5                                                 |
| API contract | Orval (OpenAPI codegen)                                          |
| Monorepo     | Bun workspaces                                                   |
| Deploy       | Docker images on GHCR, GitOps through `k8s-practice`             |

## Getting Started

### Prerequisites

- Bun 1.4.2
- Tailscale on the same tailnet as the Oracle VM (`oracle.tailcb9a25.ts.net`)
- The `ssh oracle` host, to start and stop the database

PostgreSQL runs in Docker on the VM; the web and API apps run locally with Bun. No SSH tunnel is needed.

### 1. Install dependencies

```bash
bun install
```

This also installs the Git hooks (see [Checks](#checks)).

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

People sign in with [uniAuth](https://github.com/unishare-oss/uniAuth/blob/main/docs/integrating-an-app.md). The API refuses to start without `BETTER_AUTH_*` and `UNIAUTH_*` in `apps/api/.env`. For development, uniAuth runs at <https://auth-dev.psstee.dev> with a local client registered for `http://127.0.0.1:3013/api/auth/callback/uniauth`:

```env
# apps/api/.env
UNIAUTH_ISSUER="https://auth-dev.psstee.dev/api/auth"
UNIAUTH_CLIENT_ID="…"       # from the local client
UNIAUTH_CLIENT_SECRET="…"   # from the local client

# apps/web/.env
NEXT_PUBLIC_UNIAUTH_URL="https://auth-dev.psstee.dev"
```

The issuer must be https: uniAuth advertises an https issuer for any host other than localhost, so plain http breaks ID-token verification.

### 3. Start the database

```bash
bun run db:up
```

This copies `docker-compose.yml` to `~/uniloom` on the VM and starts PostgreSQL there, bound only to the VM's Tailscale IP on port `5434`: reachable from the tailnet, not from the internet. `DATABASE_URL` in `apps/api/.env.example` already points at it. Stop it with `bun run db:down`; the data stays in the `postgres_data` volume on the VM.

### 4. Generate clients and migrate

The Prisma client and the web API client are gitignored, so generate them after cloning and after pulling schema changes:

```bash
bun run db:generate
bun run api:generate
bun run db:migrate
```

Add models to `apps/api/prisma/schema.prisma` as slices need them, then create a migration with `bun run db:migrate`.

### 5. Start development servers

```bash
bun run dev
```

- Web: <http://127.0.0.1:3013> (open `127.0.0.1`, not `localhost`: it must match `BETTER_AUTH_URL` and the client's registered redirect)
- API health: <http://localhost:3011/health>

`bun run dev` starts the API, the web app and the notification worker.

### 6. Seed test data

After signing in once:

```bash
bun run db:seed
```

This adds test projects with a case for every rule built so far and prints what to try. It goes through the API's services, so the data follows the same rules. Reruns replace only the seed projects and leave other projects alone. Set `SEED_OWNER_EMAIL` to choose the account; the default is the first person who signed in.

| Key | Project                                                |
| --- | ------------------------------------------------------ |
| TG  | Guided                                                 |
| TS  | Standard                                               |
| TR  | You as manager                                         |
| TM  | You as member                                          |
| TC  | Self-claim turned off                                  |
| TL  | Lowered checklist limits                               |
| TX  | A project you're not in                                |
| TI  | Review inbox: submission, return/resubmission, history |

### Run everything in Docker

```bash
bun run up     # builds the images, starts db → migrate → api → web, waits until healthy
bun run down
```

`migrate` applies Prisma migrations and exits before the API starts. The web app is at <http://127.0.0.1:3013> and the API at <http://localhost:3011>, so stop `bun run dev` first: they use the same ports. Rebuild after code changes with `bun run up` again.

## Project Structure

| Path                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `apps/web`                         | Next.js App Router, Tailwind CSS, shadcn/ui          |
| `apps/api`                         | Hono on Bun, Prisma schema and migrations            |
| `skill`                            | Agent skill files, written after the MCP server      |
| `docs`                             | Plans, ADRs and tech debt                            |
| `docker-compose.yml`               | PostgreSQL (on Oracle), plus migrations, API and web |
| `.github/workflows/`               | CI, image builds, release                            |
| `Dockerfile.api`, `Dockerfile.web` | Production images for the API and web app            |

## Roadmap

See [`MVP.md`](MVP.md) §14 for the full build order and [`docs/plans/`](docs/plans) for each slice's plan.

| Slice | Description                                                   | Status      |
| ----- | ------------------------------------------------------------- | ----------- |
| 1     | Project setup: Bun workspace, Hono, Next.js, Prisma, CI       | ✅ Done     |
| 2     | Data model: projects, items, states, labels, blocked-by       | ✅ Done     |
| 3     | Rules engine: mode presets, switches, checklist limits, gates | In progress |
| 4     | MCP server: tools, instructions, access tokens, activity log  | Next        |
| 5     | Sign-in with uniAuth                                          | ✅ Done     |
| 6     | Users and roles: members, owner / manager / member            | ✅ Done     |
| 7     | Designs and ADRs                                              | Planned     |
| 8     | Web: board and item lists, both modes                         | ✅ Done     |
| 9     | Web: slice page with design review and Approve, ADR pages     | Planned     |
| 10    | Record: commits, PRs, documents with Mermaid                  | Planned     |
| 11    | Planned vs actual                                             | Planned     |
| 12    | Agent setup files: skill and `AGENTS.md` block                | Planned     |

## Review Notifications

The notification worker turns review events into notifications. `bun run dev:worker` starts it alone; the Docker Compose `notification-worker` service runs the same entry point after migrations complete. A committed submission stays visible in Needs review while the worker is down; per-user history appears after delivery. In Review hands move authority to project Owners and Managers. Open task and project links from `/reviews` to take action.

The worker claims due events with PostgreSQL row locks, fans out to eligible snapshotted recipients, and commits notifications and processing status together. Failures retry from 5 seconds to a 5-minute cap; after 10 failures the event has `failedAt` set. Logs contain event ids and sanitized errors. To requeue a failed event after fixing its cause:

```bash
bun run --cwd apps/api notifications:retry EVENT_UUID
```

The command uses database credentials; it is not a public endpoint. Processed events and notifications remain for history. A retention policy and task-specific reviewers are future improvements. Stop workers before database-backed worker tests, which intentionally exercise due-event claims against the dev database.

## Checks

```bash
bun run lint
bun run typecheck
bun run test
bun run --cwd apps/api test:e2e
bun run build
```

The Git pre-commit hook formats staged files and runs lint and typecheck; the commit-msg hook checks [Conventional Commits](https://www.conventionalcommits.org) with commitlint. The e2e tests don't need uniAuth: they start a mock provider.

## Branches, CI and Releases

Work goes into `dev` through pull requests; `dev` is merged into `main` to release. The pipeline follows Unishare's:

| Workflow                    | When                        | What                                                                                                                                                                                                        |
| --------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                    | push and PR to `main`/`dev` | Five parallel jobs: lint, typecheck/OpenAPI, unit tests, integration tests (PostgreSQL), and API/web build                                                                                                  |
| `docker.yml`                | push to `main`/`dev`        | Builds only the changed images on native `linux/arm64` runners and pushes them to GHCR: `latest` + `sha-<commit>` from `main`, `dev` + `sha-<commit>-dev` from `dev`. Then writes the tag to `k8s-practice` |
| `release.yml`               | after images on `main`      | semantic-release: version, `CHANGELOG.md`, GitHub release, and `v<version>` image tags                                                                                                                      |
| `dependabot-auto-merge.yml` | Dependabot PRs to `main`    | Approves and auto-merges weekly dependency updates                                                                                                                                                          |
| `codeql.yml`                | by hand                     | CodeQL analysis                                                                                                                                                                                             |

Repository settings the pipeline reads:

- Secrets `APP_ID`, `APP_PRIVATE_KEY`: the release bot. Without them the release is skipped.
- Secrets `GITOPS_APP_ID`, `GITOPS_APP_PRIVATE_KEY`, and variables `GITOPS_VALUES_FILE` (main) / `GITOPS_VALUES_FILE_DEV` (dev): the values file in `k8s-practice` to write image tags into. Without the variable the deploy step is skipped.
- Variables `API_URL` / `DEV_API_URL`: baked into the web image. Without them the Dockerfile defaults are used.
