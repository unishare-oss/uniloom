# TD-023: Deleting a project checks the role outside a transaction

Status: Open
Found: 2026-10-16, in plan 51

## Problem

`deleteProject` calls `requireRole(projectId, userId, ['OWNER'])` and then
`softDeleteProject` as two separate queries. If the caller is demoted or removed
between them, the delete still goes through.

## Why it was left

The window is a few milliseconds, only an Owner can be in it, and other owner-only
services (e.g. `updateProject`) work the same way. A transaction with a locked member
row would add code for a very rare case.

## Fix

Run the role check and the update in one transaction with the member row locked
(`requireRole` already accepts a transaction client), or make the update conditional on
the caller still being an Owner.
