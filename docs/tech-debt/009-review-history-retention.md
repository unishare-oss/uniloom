# TD-009: Review history has no retention policy

Status: Open
Found: 2026-10-07, in plans 30, 28, and 14

## Problem

Processed review events and per-recipient notifications remain indefinitely.
Grouped history queries aggregate the recipient's records, so storage and aggregation
cost grow with submission volume. Both API views and history pages are bounded,
but their underlying history is not.

## Why it was left

Retaining actual resubmissions is part of the agreed inbox behavior. There is no
agreed archival window yet; deleting historical records would change that behavior.
No queue dependency or generic job framework is needed for the current delivery.

## Fix

Choose a retention/archive policy with the user before large-scale use. Measure
grouped-query plans with representative recipient volume, then add a maintained
summary only if needed. Keep independent read states and explicit observed-id
mutations when introducing email, push, or other channels.
