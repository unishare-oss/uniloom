# TD-021: MCP clients may repeat shared instructions in tool descriptions

Status: Open
Found: 2026-10-15, in plan 46

## Problem

The connected client displayed the entire server instruction block before every
Uniloom tool during the UG-2 test. The repository already sends that block once in
initialize and has individual descriptions in tools/list. The protocol discovery
e2e case in `apps/api/test/mcp.e2e-spec.ts` captures initialize and tools/list and
asserts the shared introduction is absent from every tool description; it passed
after the baseline database migrations were applied.

## Why it was left

Client-side presentation/expansion is outside this repository. Removing server
instructions would hide shared workflow rules from clients that use them correctly.
No repository-side duplicate block was found to remove.

## Fix

Inspect the connecting client's MCP adapter and request deduplication there.
Keep the discovery regression check and shared instructions in Uniloom.
