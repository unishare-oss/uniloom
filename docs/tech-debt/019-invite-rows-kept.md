# TD-019: Old invite links and join requests are never deleted

Status: Fixed
Found: 2026-10-13, in plans 43 to 45

## Problem

A replaced or deleted invite link keeps its row with `revokedAt` set, and a decided join
request keeps its row with its status. Nothing removes them while the project exists. A
project that replaces its link every day adds 365 `invite` rows a year.

## Why it was left

The rows are what make "one slot per person per link" and "requests outlive their link"
work ([ADR-0015](../adr/0015-project-invite-links.md)), they are small, and a project
delete cascades to them. ADR-0011 left the same question open for events and
notifications, and the two should get one retention policy.

## Fix

Fixed in the same PR, after the user asked why it was left (2026-10-13). `createInvite`
deletes the project's links that were revoked more than 30 days ago, with their decided
requests, in the transaction that makes the new link (`deleteOldRevoked`). A link someone
still waits on is kept. No scheduled job is needed: a project only collects old links by
creating new ones. The missing rate limit is tracked separately in
[TD-020](020-no-rate-limit-on-invites.md).
