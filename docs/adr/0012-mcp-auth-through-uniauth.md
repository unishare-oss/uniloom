# ADR-0012: Agents sign in to MCP through uniAuth OAuth

Status: Proposed
Date: 2026-10-11

## Context

`MVP.md` §12 says agents use personal access tokens, created on the website, stored hashed
and sent as `Authorization: Bearer <token>` to `/mcp`. Unishare, which also signs people in
with uniAuth, does it differently: uniAuth runs Better Auth's `mcp()` plugin and is the
OAuth server for MCP clients, and Unishare's `/mcp` only checks the access JWT that uniAuth
issues (`unishare/apps/api/src/modules/mcp/mcp-token.verifier.ts`).

The user chose to do it the Unishare way, and to give an agent exactly its person's
project role, without scopes.

## Options

1. **Personal access tokens in Uniloom** (Better Auth's API key plugin). Uniloom creates,
   hashes, lists and revokes keys; a web page to create them. Self-contained, but Uniloom
   stores secrets and the person copies a key into their agent's config.
2. **uniAuth OAuth, as Unishare does.** `claude mcp add` finds uniAuth through Uniloom's
   protected-resource metadata, the person signs in and consents in the browser, and
   uniAuth issues a short-lived JWT for Uniloom's `/mcp`. Uniloom stores nothing.
3. **Option 2 plus Uniloom scopes** (`uniloom:read`, `uniloom:write`), so a person can give
   an agent less than their role, e.g. read only.

## Decision

Option 2.

- Uniloom only serves resources. `/mcp` takes a Bearer JWT and checks it with `jose`
  against uniAuth's JWKS: issuer `UNIAUTH_ISSUER`, audience `MCP_RESOURCE` (Uniloom's own
  `/mcp` URL), not expired.
- The token's `sub` is a uniAuth user id; it maps to the Uniloom user through the
  `account` row (`findUserIdBySub`), never by email. A person who never signed in to
  Uniloom, or hasn't accepted its terms, is refused.
- **Access is the person's project role.** Tools call the same services as the website,
  so role and workflow rules apply unchanged. There are no Uniloom scopes. The one MCP-only
  rule is §9's: agents can't move to Ready or Done.
- The activity log records the OAuth client id from the token as "which agent".

## Consequences

- Uniloom needs no token table, no hashing and no tokens page. People sign in to uniAuth
  only, and an agent can't hold a long-lived secret.
- **uniAuth must change first:** it has to accept Uniloom's `/mcp` as a second MCP
  resource (token audience). This is work in the uniAuth repo, and Uniloom's MCP can't
  sign anyone in until it lands.
- A revoked token keeps working until it expires (15 minutes), because Uniloom checks it
  locally (TD-010).
- No read-only agents: a person can't give an agent less than their own role. Scopes
  (option 3) can be added later without changing the tools.
- Supersedes the "personal access tokens" line of `MVP.md` §12 once accepted.
