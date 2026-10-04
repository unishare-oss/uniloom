# TD-001: Declare the membership check instead of calling it in every service function

Status: Open
Found: 2026-10-04, in plan 04 (Items)

## Problem

Workspace membership is checked by hand at the start of every service function that
touches a workspace's data: `requireMember(workspaceId, userId)` directly, or through
`loadItem` (`apps/api/src/modules/items/item.service.ts`). Nine item functions do this
today, and every later feature (checklists, designs, ADRs, comments, …) will add more.

A new function that forgets the call leaks or changes another workspace's data. The only
safety net is the e2e test "answers 404 to someone outside the workspace, on every route",
and it only covers routes someone remembered to add to its list.

## Why it was left

With nine functions, an explicit call is the simplest thing that works and is easy to
read (`AGENTS.md`: keep it simple, reuse after three repeats). The check also has to live
at the service level, not in REST middleware, because MCP tools will call the services
directly and must get the same check.

## Fix

Make "this needs membership" something a function or route declares once, so forgetting
it is hard, while MCP still goes through it. Options to weigh when the number of
workspace-scoped functions grows:

- A wrapper at the service level, e.g. `memberOnly((workspace, userId, input) => …)`,
  that resolves the workspace (from a workspace id or an item id), checks membership and
  passes the workspace in. REST handlers and MCP tools both call the wrapped function.
- TypeScript decorators on service methods (`@MemberOnly()`), if services become classes;
  more machinery than the current plain functions.
- Route-level Hono middleware for `/workspaces/:workspaceId/*` that sets `c.var.workspace`,
  only as an addition: it would not cover MCP or routes addressed by item id.

Whichever is chosen, keep a test that walks every workspace-scoped route (and later every
MCP tool) as a non-member and expects 404.
