# ADR-0021: Local-first setup with loopback addresses

Status: Proposed
Date: 2026-10-16

## Context

New developers could not run Uniloom without Tailscale, the Oracle VM and a
dev OAuth client, and the `localhost` vs `127.0.0.1` rules kept breaking
sign-in. The provider (`@better-auth/oauth-provider`) allows `http` redirects
for native clients only on exactly `localhost`, `127.0.0.1` or `[::1]`, and
rejects loopback `http` for web clients entirely, so a local client must be
registered as native (`--local`).

## Options

1. Everyone uses the shared Oracle database and dev uniAuth.
2. A fully local setup: own uniAuth plus both databases in Docker, with
   Uniloom on `127.0.0.1` and uniAuth on `localhost`.

## Decision

Option 2 for fresh setups (`SETUP.md`); option 1 stays for day-to-day team
work. Port map: Uniloom web `127.0.0.1:3013`, API `127.0.0.1:3011`, uniAuth
`localhost:3002`, databases `5433` (uniAuth) and `5434` (Uniloom).
Uniloom is opened at `127.0.0.1` because uniAuth returns to the registered
redirect exactly; uniAuth stays on `localhost` because Uniloom checks its
issuer letter for letter.

## Consequences

Two supported paths to document and keep working. Local sign-in clients get
no logout or account-deletion notices from uniAuth; those need the shared
dev servers.
