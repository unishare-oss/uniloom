# ADR-0001: Hono for the API, not NestJS

Status: Accepted
Date: 2026-10-03

## Context

The API serves three things: REST routes for the website, the Better Auth handler, and
one MCP endpoint (`/mcp`). Most of the logic is the rules engine, which both REST and
MCP call. The runtime is Bun. Unigym uses NestJS.

## Options

- **NestJS.** Familiar from Unigym, strong structure for large APIs. Needs decorators
  and `reflect-metadata` on Bun, and an adapter for Better Auth. Each feature brings a
  module, controller, service and DTOs.
- **Hono.** Small, built on Web `Request`/`Response`, runs on Bun directly. Better Auth
  mounts with one line. Less structure out of the box.

## Decision

Hono.

## Consequences

- Fewer files and less framework wiring per slice, so designs stay near the ~8
  meaningful functions per slice and planned vs actual stays readable.
- Structure is by convention (`apps/api/AGENTS.md`), not enforced by the framework.
- Unigym's Nest code (auth guards, consent) is ported, not copied.
