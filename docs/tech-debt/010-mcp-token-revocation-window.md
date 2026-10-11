# TD-010: A revoked MCP token works until it expires

Status: Open
Found: 2026-10-11, in plan 33

## Problem

Uniloom checks an agent's access JWT locally against uniAuth's JWKS (ADR-0012). It never
asks uniAuth whether the token was revoked, so after a person revokes their agent's
access in uniAuth, or is removed there, the token keeps working until it expires.

## Why it was left

uniAuth issues 15-minute access tokens for this reason, as it does for Unishare. Asking
uniAuth on every MCP call (token introspection) would add a network round trip to every
tool call. Removing someone from a Uniloom project still takes effect at once, because
every tool checks the project role on each call.

## Fix

If 15 minutes turns out too long: call uniAuth's introspection endpoint and cache the
answer briefly, or listen for uniAuth's back-channel logout and refuse tokens issued
before it.
