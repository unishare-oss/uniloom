# TD-003: Signed-in users can open the landing page and bounce through login

Status: Open
Found: 2026-10-05, while building the landing and login pages (no plan)

## Problem

`src/proxy.ts` sends signed-out visitors from `/` to `/welcome`, but lets anyone open
`/welcome`, signed in or not. The landing page always shows "Sign in" and "Get started",
both linking to `/login`. A signed-in user who clicks either goes to `/login`, whose silent
uniAuth check finds the session and sends them back to `/`: it works, but with a needless
round trip through uniAuth, and the landing page never shows that they are signed in.

## Why it was left

The user wanted `/welcome` to be its own page with its own URL. Whether signed-in users
should see it was not decided, and the bounce does no harm.

## Fix

Either, in `src/proxy.ts`, redirect signed-in visitors from `/welcome` to `/` (one line,
next to the signed-out redirect), or keep `/welcome` open and make the landing nav show
"Open your workspaces" linking to `/` when the session cookie exists.
