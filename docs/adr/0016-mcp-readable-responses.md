# ADR-0016: MCP confirmations are compact and link to the website

Status: Proposed
Date: 2026-10-15

## Context

Testing Unigym through MCP returned entire item/document records after writes,
opaque assignee ids and no website links. MVP §9 calls for slim responses with
full detail through get tools. REST clients and MCP agents need different shapes.

## Options

1. Keep returning REST records unchanged after every mutation.
2. Shape compact MCP confirmations and enrich reads with names and website URLs.
3. Add response verbosity flags to each tool.

## Decision

Propose option 2. The user requested compact confirmations, readable assignees
and website URLs; I propose implementing those in the MCP service without changing
REST shapes. Use `BETTER_AUTH_URL`, documented as the web origin, and existing web
routes. Item assignees expose name and email after authorization, because email is
already the MCP input for naming another project member. Keep full bodies in get tools.

Expose existing Knowledge-to-ticket linking with explicit link/unlink tools and
reuse the current item-document service. Preserve partial-save error messages.
Shared workflow rules remain server instructions; tool descriptions explain only
their individual inputs and behavior. Verify protocol output before attributing
repeated rules to repository code.

## Consequences

- Responses are shorter, readable and directly navigable.
- Clients relying on full mutation records must call a get tool; document this change.
- Readable assignees need a batched profile read; authorization must happen first.
- URLs follow the configured web origin, so deployment configuration must remain correct.
- No new permission rules, database tables or per-tool verbosity switches are needed.
- Client-added instruction duplication may remain outside this repository's control.
