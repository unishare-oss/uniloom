# TD-022: A deleted project keeps its key prefix

Status: Open
Found: 2026-10-16, in plan 51

## Problem

Projects are soft-deleted (ADR-0020), and `Project.keyPrefix` is globally unique. A
deleted project therefore still holds its prefix, so a new project cannot use it and
creating one gets `key_prefix_taken`.

## Why it was left

Freeing the prefix needs a partial unique index (`WHERE "deletedAt" IS NULL`) in raw
SQL, and MCP key lookups would then have to pick the live row. Projects are rarely
deleted, so the plain unique index stays for now.

## Fix

Replace the unique index with a partial one on live projects, and make
`findProjectIdByKey` and `findItemIdByKey` filter `deletedAt: null` (plan 51 already
does). Decide what a restore does when the prefix has been reused.
