# Uniloom Repository Guide

## Scope

This file applies to the whole repository. Read the closer guide when working in
`apps/api` or `apps/web`. Keep instructions in exactly these three `AGENTS.md` files
unless the project grows enough to need another scope.

## Folder Structure

```text
uniloom/
├── apps/
│   ├── api/             # Hono API on Bun, Prisma schema and migrations
│   └── web/             # Next.js App Router application
├── skill/               # Agent skill files (SKILL.md, DESIGN.md, ...), written after the MCP server
├── docs/                # Plans, ADRs and tech debt (see docs/README.md)
├── .github/workflows/   # CI, image builds, release (see README.md)
├── docker-compose.yml   # Docker: PostgreSQL, migrations, API and web
├── MVP.md               # Product spec and build order
└── AGENTS.md            # Repository-wide instructions
```

This is a Bun workspace. Use the root `package.json` scripts and the committed Bun
lockfile. Keep API implementation in `apps/api` and browser UI in `apps/web`. Share
contracts only when both workspaces actually need them.

## Working Rules

- Do not create a git commit or push changes unless the user explicitly asks.
- Do not credit Claude or any other AI tool as an author or contributor: no
  `Co-Authored-By` trailers in commits and no "Generated with" lines in PRs.
- Write commit messages as Conventional Commits (`feat(api): ...`, `fix(web): ...`,
  `chore: ...`); commitlint rejects others, and semantic-release versions from them.
- Branch from `dev` and open pull requests into `dev`. `main` is for releases.
- Preserve unrelated local changes. Do not add secrets or print `.env` values.
- Follow the nearest app guide and existing code patterns. Prefer direct, readable
  changes over speculative layers.
- Keep it simple. Don't over-engineer: pick the plainest way the language, framework
  or library already offers (e.g. Hono's `app.get('/path', handler)`), and avoid clever
  abstractions, factories, generics or wrappers that a reader has to decode. If the
  simple way and the fancy way both work, use the simple way.
- Write functions as arrow functions (`const name = () => {}`), never `function name()`.
  Lint enforces it (`func-style`, `prefer-arrow-callback`).
- Make code reusable only when it repeats: once something is written the same way three
  times, extract a shared function or component. Not before.
- `MVP.md` is the spec. Build in the order of its §14 and do not pull later slices
  forward.
- The API owns Uniloom data, authorization and the workflow rules. The website and the
  MCP server call the same rule checks; never duplicate a rule in the web app.
- For database work, follow `README.md`: PostgreSQL runs in Docker on the Oracle VM
  and is reached over Tailscale (`oracle.tailcb9a25.ts.net:5434`). Do not start a local
  database by default.

## Independent review

Do not run a review yourself. The user runs the `code-reviewer` agent
(`.claude/agents/code-reviewer.md`) or another reviewer such as Codex when they want one.
Run it only when the user asks: then give it the base branch to diff against and the
plan's path, nothing about how or why you built it, fix the findings you agree with,
rerun the checks, and report its verdict and findings (fixed or not, and why).

## Reporting finished work

When you finish implementing something, end with a summary that always includes:

- **Architecture decisions:** each decision made, and who made it (the user, you, or
  both), e.g. "you chose soft delete for items; I kept the membership check in services".
- **Trade-offs:** what each decision gives up, and what was left out on purpose.
- **What was built, by priority:** group the list into P0 (the feature can't be used
  without it), P1 (needed soon, but the main flow works without it) and P2 (safety net or
  rarely used), with one line on why each sits where it does:
  - backend: every new or changed endpoint (method, path, who may call it) with a
    one-line description and its main error codes;
  - frontend: every new or changed page or feature (route, what the user sees and can do);
  - which ones to build on next (e.g. which the web app or MCP tools need first).
- **Status:** checks run and their results, what is committed or pushed, and anything
  still open.

## Checks

Run the checks relevant to changed files. Root commands are `bun run lint`,
`bun run typecheck`, `bun run test`, and `bun run build`.

## Tracking: `docs/`

There is no issue tracker. Plans, ADRs and tech debt are Markdown files in `docs/`;
`docs/README.md` has the formats.

Flow for a plan: Aligning → Ready → In Progress → Blocked → In Review → Done → Canceled.

Rules:

- Ask me to confirm the scope before you write a new plan.
- Keep each plan small: at most 6 done-when items. If a feature I propose needs more,
  don't squeeze it into one plan: propose splitting it into two or three smaller
  features, each its own plan, and let me confirm the split. One big plan makes an AI
  agent lose track and invent things.
- Write the plan in `docs/plans/` before any code: scope, a done-when checklist of 3 to
  6 items derived from the spec (no generic items), and a design with the meaningful
  functions, what each does and why, and Mermaid flows.
- Do not start code until I set the plan to Ready. Editing a Ready plan's design sends it
  back to Aligning.
- Tick each item the moment it is met. Do not wait for the end.
- Every item must be ticked before In Review. If you cannot finish without me, set
  Blocked and write the reason in the plan.
- I review all code. Never set a plan to Done. Stop at In Review.
- When you finish, fill in Changes: commits, what changed and how, planned vs actual.
- Write an ADR in `docs/adr/` when a choice outlives one slice, as Proposed. I accept
  it. Reference ADRs from plans instead of repeating the reasoning.
- When you take a shortcut or find a problem you are not fixing now, add a file to
  `docs/tech-debt/` and mention it in the plan.
- A plan that adds a rule also adds its cases to the seed (`apps/api/scripts/seed.ts`),
  with item titles that say what to try and what should happen.
