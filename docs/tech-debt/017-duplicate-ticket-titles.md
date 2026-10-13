# TD-017: Nothing warns when a new ticket duplicates an open one

Status: Open
Found: 2026-10-13, in a discussion about concurrent creates (no plan)

## Problem

Keys can't collide: creating an item increments `project.nextItemNumber`, which locks the
project row (`items/item.repository.ts`), and `(projectId, number)` is unique. Titles have
no check, which is right (two tickets may share a title), but it lets the same work be
created twice: an agent retries `save_item` after a timeout, or two agents both create
"Email verification step". The result is TG-12 and TG-13 for one piece of work, and
nobody is told.

## Why it was left

It only came up in discussion; no plan covers item creation now. Refusing duplicates
(`409`) or idempotency keys were considered and set aside: the first blocks legitimate
same-title tickets, the second only covers retries.

## Fix

Warn, don't block. When an item is created and an open ticket (not Done, Canceled or
deleted) with the same title, compared case-insensitively and trimmed, exists under the
same parent (or at the top level), still create it, and:

- MCP `save_item` adds to its reply: "TG-12 has the same title; delete this one if it's
  a duplicate";
- `POST /api/projects/:projectId/items` returns `duplicateOf: { id, key }`, and the
  new-item dialog shows the hint with a link.

The check is a read inside the create transaction, in the items service, so the website
and MCP share it. Add a seed item titled to try it.
