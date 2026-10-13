# TD-020: No rate limit on the invite endpoints

Status: Open
Found: 2026-10-13, in plans 43 to 45

## Problem

The API has no rate limit anywhere. For invites that means nothing slows down an owner or
manager who creates links in a loop, or a signed-in person who tries tokens or asks to
join in a loop. A link's limit bounds the requests per link, not the calls.

## Why it was left

Guessing a 256-bit token is not practical, creating links needs a role in the project, and
old links are now deleted (TD-019). A limit for these routes alone would be a one-off: the
whole API needs one, including sign-in and MCP, and that is its own slice with its own
decisions (per user or per IP, where the counters live with more than one API instance).

## Fix

Add rate limiting to the API as a whole, then give `POST /projects/:projectId/invite`,
`GET /invites/:token` and `POST /invites/:token/join` their limits.
