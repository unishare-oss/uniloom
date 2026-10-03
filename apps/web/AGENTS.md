<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Web App Guide

## Folder Structure

```text
apps/web/
├── public/             # Static assets
├── src/
│   ├── app/            # App Router pages, layout, and global CSS
│   ├── components/     # Feature components and shared UI primitives
│   │   └── ui/         # shadcn-style UI components
│   ├── lib/            # Browser utilities
└── AGENTS.md
```

Keep pages in `src/app`, reusable UI in `src/components`, and browser helpers in
`src/lib`. Use Server Components by default and client components when browser
behavior requires them. Keep access control and workflow rules in the API.

The web app proxies `/api/*` to the Hono API through `next.config.ts`, so the
session cookie will stay on the web host. Set `API_URL` (server); see `.env.example`.
There is no agent chat on the website: it is for reading, approving and reviewing.

For web changes, run `bun run --cwd apps/web lint`, `typecheck`, and `build` as
appropriate. Read the Next.js guide noted above before changing Next.js APIs.
