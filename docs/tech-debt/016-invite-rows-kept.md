# TD-016: Old invite links and join requests are never deleted

Status: Open
Found: 2026-10-13, in plans 39 to 41

## Problem

A replaced or deleted invite link keeps its row with `revokedAt` set, and a decided join
request keeps its row with its status. Nothing removes them while the project exists. A
project that replaces its link every day adds 365 `invite` rows a year.

The API also has no rate limit, so nothing slows down someone who creates links or asks to
join in a loop. A link's limit bounds the requests per link, not the links per project.

## Why it was left

The rows are what make "one slot per person per link" and "requests outlive their link"
work ([ADR-0014](../adr/0014-project-invite-links.md)), they are small, and a project
delete cascades to them. ADR-0011 left the same question open for events and
notifications, and the two should get one retention policy.

## Fix

Delete revoked links, with their decided requests, once they are older than some age (for
example 90 days) and have no `PENDING` request. A scheduled job needs the worker that
plan 31 added. Add a rate limit when the API gets one.
