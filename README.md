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

**New here? Follow [`SETUP.md`](SETUP.md).** It takes you from a fresh Windows, macOS or
Linux computer to a signed-in Uniloom, with your own uniAuth and both databases in Docker.
You only need a GitHub account with access to
[uniAuth](https://github.com/unishare-oss/uniAuth). The guide is written so you can also
hand it to an AI coding agent and let it do the steps.

### What runs where

| What              | Address                 | Notes                                               |
| ----------------- | ----------------------- | --------------------------------------------------- |
| Uniloom web app   | <http://127.0.0.1:3013> | Open this one. `localhost:3013` breaks sign-in      |
| Uniloom API       | <http://127.0.0.1:3011> | The web app proxies `/api` to it                    |
| uniAuth (sign-in) | <http://localhost:3002> | Stays on `localhost`: its issuer is checked exactly |
| Uniloom database  | `127.0.0.1:5434`        | PostgreSQL 17 in Docker                             |
| uniAuth database  | `127.0.0.1:5433`        | PostgreSQL 17 in Docker                             |

Open the web app at `127.0.0.1`, not `localhost`. uniAuth only redirects local clients
back to a loopback IP, so `BETTER_AUTH_URL`, uniAuth's `UNILOOM_ORIGIN` and the OAuth
client's redirect all use `http://127.0.0.1:3013`. [`SETUP.md`](SETUP.md#why-some-urls-say-127001)
explains each one.

### Day to day

With the local setup from [`SETUP.md`](SETUP.md), one command starts everything (the
databases, uniAuth, the API, the web app and the notification worker), with each line
labelled by part:

```bash
bun run dev:local
```

Then open <http://127.0.0.1:3013>. `Ctrl+C` stops it all.

| Command                 | What it does                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| `bun run setup`         | Creates missing `.env` files, starts the databases, migrates, generates code |
| `bun run setup:uniauth` | Creates your local uniAuth account and connects Uniloom to it                |
| `bun run dev:local`     | Starts everything for local development                                      |
| `bun run check:setup`   | Checks uniAuth, the API, the web app and sign-in (OK or FAIL)                |
| `bun run stop`          | Stops whatever runs on ports 3002, 3011 and 3013                             |

After pulling: `bun run uniauth:install`, `bun install`, then `bun run setup`.

With the team infrastructure below instead, start uniAuth's dev server elsewhere and run
`bun run dev` (the API, the web app and the worker).

Add models to `apps/api/prisma/schema.prisma` as slices need them, then create a migration
with `bun run db:migrate`.

### Team infrastructure (optional)

Maintainers on the tailnet can use the shared database and dev uniAuth instead of local
ones. This needs Tailscale on the same tailnet as the Oracle VM
(`oracle.tailcb9a25.ts.net`), the `ssh oracle` host, and a dev OAuth client from the
uniAuth maintainer.

```bash
bun run db:up     # starts PostgreSQL on the VM, bound to its Tailscale IP on port 5434
bun run db:down   # stops it; the data stays in the postgres_data volume on the VM
```

`apps/api/.env.example` already points `DATABASE_URL` at it. For uniAuth, set
`UNIAUTH_ISSUER="https://auth-dev.psstee.me/api/auth"` and the client's id and secret in
`apps/api/.env`, and `NEXT_PUBLIC_UNIAUTH_URL="https://auth-dev.psstee.me"` in
`apps/web/.env`. The issuer must be https: uniAuth advertises an https issuer for any host
other than a loopback address, so plain http breaks ID-token verification.

### Seed test data

After signing in once:

```bash
bun run db:seed
```

This adds test projects with a case for every rule built so far and prints what to try. It goes through the API's services, so the data follows the same rules. Reruns replace only the seed projects and leave other projects alone. Set `SEED_OWNER_EMAIL` to choose the account; the default is the first person who signed in. List several, comma-separated (`SEED_OWNER_EMAIL=test@email.com,psst@gmail.com`), and the others get the first account's role in every seed project.

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

### Reliability documents

Knowledge supports SLO (service objectives) and SLA (service agreements) alongside
briefs, proposals, specs, references, ADRs and tech debt. Owners and Managers create,
edit and archive SLO/SLA documents; members can read them in either project mode.
They are project Markdown documents with templates, not numbered workflow records.
Link them to Guided tickets through the existing related-document controls or MCP.
SLA bodies may link supporting SLOs; no monitoring, contractual acceptance, breach
tracking or automatic propagation is implied. Targets and terms start as placeholders.

### Connect an agent (MCP)

Agents such as Claude Code connect to Uniloom's `/mcp` on the web origin and sign in through uniAuth (ADR-0012). Uniloom stores no tokens; it checks the access token uniAuth issues, and the agent gets exactly its person's project role. Set `MCP_RESOURCE="http://127.0.0.1:3013/mcp"` (the web origin plus `/mcp`) in `apps/api/.env`, then:

```sh
claude mcp add --transport http uniloom http://127.0.0.1:3013/mcp
```

Run `/mcp` in Claude Code to sign in. This needs uniAuth to accept Uniloom's `/mcp` as an MCP resource (a second token audience next to Unishare's); until it does, sign-in fails even though the e2e tests pass. The read tools include `list_projects`, `list_items`, `get_item`, `list_states`, `list_labels`, `get_criteria`, `list_documents` and `get_document`; the server lists every tool, including the write tools such as `save_item` and `save_document`. Projects and items are addressed by key (`TG`, `TG-12`), documents by id. `link_document` and `unlink_document` take `{ key, id }` to link existing Knowledge documents (including proposals) to Guided tickets using the ticket edit permissions. Item responses include readable assignees, and project/item/document responses include website URLs. `save_item` and `save_document` return compact confirmations; call `get_item` or `get_document` for bodies, checklists and related records. Shared rules are sent in server instructions, not repeated in individual tool descriptions.

### Run everything in Docker

```bash
bun run up     # builds the images, starts db → migrate → api → web, waits until healthy
bun run down
```

`migrate` applies Prisma migrations and exits before the API starts. The web app is at <http://127.0.0.1:3013> and the API at <http://localhost:3011>, so stop `bun run dev` first: they use the same ports. Rebuild after code changes with `bun run up` again.

## Project Structure

| Path                               | Purpose                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `apps/web`                         | Next.js App Router, Tailwind CSS, shadcn/ui                            |
| `apps/api`                         | Hono on Bun, Prisma schema and migrations                              |
| `skill`                            | Agent skill files, written after the MCP server                        |
| `docs`                             | Plans, ADRs and tech debt                                              |
| `SETUP.md`                         | Local setup from scratch on Windows, macOS and Linux                   |
| `scripts/`                         | Local setup helpers behind `bun run setup`, `dev:local`, `check:setup` |
| `compose.local.yml`                | Local databases for uniAuth and Uniloom (`db:local`)                   |
| `docker-compose.yml`               | PostgreSQL (on Oracle), plus migrations, API and web                   |
| `.github/workflows/`               | CI, image builds, release                                              |
| `Dockerfile.api`, `Dockerfile.web` | Production images for the API and web app                              |

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
