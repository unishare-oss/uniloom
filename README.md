# Uniloom

Bun monorepo with a Next.js web app, a Hono API, Tailwind CSS, shadcn/ui, Prisma, and PostgreSQL. Uniloom is a self-hosted work tracker for building software with a coding agent; see [`MVP.md`](MVP.md) for the spec and build order.

## Start locally

Requirements: Bun 1.4.2, the `ssh oracle` host, and Tailscale on the same tailnet as the Oracle VM (`oracle.tailcb9a25.ts.net`). PostgreSQL runs in Docker on the VM; the web and API apps run locally with Bun. No SSH tunnel is needed.

```sh
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
bun run db:up
bun run db:generate
bun run db:migrate
bun run dev
```

Open <http://127.0.0.1:3013>. The API health endpoint is <http://localhost:3011/health>. `bun run db:up` copies `docker-compose.yml` to `~/uniloom` on the VM and starts PostgreSQL there, bound only to the VM's Tailscale IP on port `5434`: reachable from the tailnet, not from the internet. `DATABASE_URL` in `apps/api/.env.example` already points at it. Stop it with `bun run db:down`; the data stays in the `postgres_data` volume on the VM.

### Sign-in (uniAuth)

People sign in with [uniAuth](https://github.com/unishare-oss/uniAuth/blob/main/docs/integrating-an-app.md) (OpenID Connect). The API uses Better Auth as the OIDC client and keeps Uniloom's own session; every `/api` route needs a session and acceptance of Uniloom's terms unless it is public (health, `/api/auth/*`, the uniAuth receivers) or `GET /api/me` / `POST /api/users/me/consent`. The API refuses to start without `BETTER_AUTH_*` and `UNIAUTH_*` in `apps/api/.env`. The e2e tests do not need uniAuth: they start a mock provider.

For development, uniAuth runs on the Oracle VM in `~/uniauth-dev` (server and Postgres in Docker, bound to the Tailscale IP), served over https by `tailscale serve` at <https://oracle.tailcb9a25.ts.net> (tailnet only), with a local client for `http://127.0.0.1:3013`. It must be https: uniAuth advertises an https issuer for any host other than localhost, so plain http breaks ID-token verification. Set in `apps/api/.env`:

```sh
UNIAUTH_ISSUER="https://oracle.tailcb9a25.ts.net/api/auth"
UNIAUTH_CLIENT_ID="…"       # from the local client
UNIAUTH_CLIENT_SECRET="…"   # from the local client
```

and `NEXT_PUBLIC_UNIAUTH_URL="https://oracle.tailcb9a25.ts.net"` in `apps/web/.env`. Open the app at <http://127.0.0.1:3013>, not `localhost:3013`: it must match `BETTER_AUTH_URL` and the client's registered redirect. Local clients get no back-channel logout or deletion notices; the receivers are covered by the e2e tests.

To update that uniAuth, copy the source again and rebuild: `git -C ../uniAuth archive HEAD | ssh oracle 'rm -rf ~/uniauth-dev/src && mkdir ~/uniauth-dev/src && tar -x -C ~/uniauth-dev/src'`, then `ssh oracle 'cd ~/uniauth-dev && sudo docker compose up -d --build --wait server'`.

### Run everything in Docker

```sh
bun run up     # builds the images, starts db → migrate → api → web, waits until healthy
bun run down
```

`migrate` applies Prisma migrations and exits before the API starts. The web app is at <http://127.0.0.1:3013> and the API at <http://localhost:3011>, so stop `bun run dev` first: they use the same ports. Rebuild after code changes with `bun run up` again.

## Structure

| Path                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `apps/web`                         | Next.js App Router, Tailwind CSS, shadcn/ui          |
| `apps/api`                         | Hono on Bun, Prisma schema and migrations            |
| `skill`                            | Agent skill files, written after the MCP server      |
| `docs`                             | Plans, ADRs and tech debt                            |
| `docker-compose.yml`               | PostgreSQL (on Oracle), plus migrations, API and web |
| `.github/workflows/`               | CI, image builds, release (see below)                |
| `Dockerfile.api`, `Dockerfile.web` | Production images for the API and web app            |

Add models to `apps/api/prisma/schema.prisma` as slices need them, then create a migration with `bun run db:migrate`.

### Test data

After signing in once, `bun run db:seed` adds test projects with a case for every rule built so far (TG: Guided, TS: Standard, TR: you as manager, TM: you as member, TX: a project you're not in) and prints what to try. It goes through the API's services, so the data follows the same rules. Reruns replace only those five projects. Set `SEED_OWNER_EMAIL` to choose the account; the default is the first person who signed in.

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
