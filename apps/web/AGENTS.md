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
│   ├── app/            # Routes only: page.tsx, layout.tsx, and global CSS (theme tokens)
│   │   └── w/[workspaceId]/   # Board, items/[itemId], trash (inside the app shell)
│   ├── components/     # Every component, one folder per feature; providers.tsx
│   │   ├── auth/       # Login, consent, session bootstrap (consent redirect, silent check)
│   │   ├── board/      # Board, its columns and draggable item cards
│   │   ├── items/      # Item detail, new-item dialog, trash, kind/priority/state icons
│   │   ├── legal/      # Layout for the terms and privacy pages
│   │   ├── markdown/   # Markdown renderer and its Mermaid diagrams
│   │   ├── shell/      # App shell: sidebar and layout for signed-in pages
│   │   ├── user/       # Profile, avatar and theme switch
│   │   ├── workspaces/ # Workspace list, new-workspace dialog, workspace chip
│   │   └── ui/         # shadcn components (Base UI), added with `bunx shadcn add`
│   ├── hooks/          # React hooks (shadcn's use-mobile)
│   ├── lib/            # Browser utilities
└── AGENTS.md
```

`src/app` holds only routing files: a `page.tsx` reads the route params and renders a
component from `src/components/<feature>/`, one component per file. Browser helpers go
in `src/lib`. Use Server Components by default and client components when browser
behavior requires them. Keep access control and workflow rules in the API.

The web app proxies `/api/*` to the Hono API through `next.config.ts`, so Better
Auth's callback and the `uniloom` session cookie stay on the web host. Sign in and out
only through `src/lib/uniauth.ts`. `src/proxy.ts` redirects signed-out visitors on
protected pages to `/login`; it only checks that the cookie exists, and the API does the
real check. Set `API_URL` (server) and `NEXT_PUBLIC_UNIAUTH_URL` (build time); see
`.env.example`.

Call the API only through the hooks Orval generates in `src/lib/api/generated/` (from
`openapi.json`; run `bun run api:generate` after pulling or after `bun run api:spec`), never
with hand-written `fetch`. They all go through `src/lib/api/fetcher.ts`, as in Unishare:
queries take the data with `select: (r) => r.data`; mutations get `{ data, message, … }` in
`onSuccess`; failures throw `ApiError` (`message`, `code`, `status`), shown with
`toast.error(err.message)` (sonner). A `403 consent_required` sends the user to `/consent`.
The generated folder is not committed. `AuthBootstrap` in the layout reads the session on every page: it
sends users without consent to `/consent` and runs the silent uniAuth check for
signed-out visitors.
Look and parts (ADR-0005): colours only through the CSS variables in `globals.css` (light
and dark), never hard-coded; shadcn components from `src/components/ui/` (add more with
`bunx shadcn add`); icons only from `lucide-react`; `KindIcon`, `PriorityIcon` and
`StateLozenge` (`src/components/items/item-meta.tsx`) wherever an item's kind, priority or state
shows; `Markdown` (`src/components/markdown/markdown.tsx`) for any Markdown, with Mermaid diagrams.
Signed-in pages render inside `AppShell`. A 401 from the API sends the user to `/login`
and back (the fetcher does it).
There is no agent chat on the website: it is for reading, approving and reviewing.

For web changes, run `bun run --cwd apps/web lint`, `typecheck`, and `build` as
appropriate. Read the Next.js guide noted above before changing Next.js APIs.
