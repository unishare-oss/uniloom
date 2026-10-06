# TD-005: The seed stops on an old "Seed · Reviewer" project

Status: Open
Found: 2026-10-06, in plan 11

## Problem

`bun run db:seed` fails with "TR is used by "Seed · Reviewer", not the seed". The shared
database still has a seed project from before the Reviewer role was renamed to Manager,
so `removeOldSeed` treats it as a real project and refuses to touch it. Plan 11's seeded
slice ("Checklist: tick the rest, add evidence, reorder") was therefore written and
typechecked but not run against the database.

## Why it was left

The project lives in the shared database and the seed's guard exists to protect real
projects. Deleting it by hand is the owner's call.

## Fix

Delete the "Seed · Reviewer" project (or rename it to "Seed · Manager"), then run
`bun run db:seed` and check the new Guided slice. Or let `removeOldSeed` also accept the
old name.
