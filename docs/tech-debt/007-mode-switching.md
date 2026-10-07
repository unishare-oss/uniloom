# TD-007: Switching a project's mode

Status: Open
Found: 2026-10-07, in plan 13

## Problem

`MVP.md` §3 says switching modes later is a setting change: existing items keep their
data and the new rules apply from then on. Plan 13 lets owners change the switches but
not `mode`, so a project stays Standard or Guided for life.

## Why it was left

Nobody needs it yet: Uniloom's own work and the Unigym trial are both Guided. Standard →
Guided is the hard direction: Guided locks its states (with stable keys), so the
project's own states have to be replaced and items in states that no longer exist moved
somewhere. Task/Subtask items would also need to become Feature/Slice.

## Fix

A plan of its own: `PATCH /projects/:id` accepts `mode`, applies the new mode's preset
switches, maps old states to the new mode's states by category, and renames item kinds,
all in one transaction.
