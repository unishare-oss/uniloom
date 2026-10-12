# TD-012: Document kinds are not yet mapped onto MVP §8

Status: Open
Found: 2026-10-12, in plan 15

## Problem

Plan 15 stores documents of kind `BRIEF`, `PROPOSAL`, `SPEC` or `REFERENCE`. MVP §8 names
the types change, feature, reference and overview. How they line up is undecided: a SPEC
may become a feature document, an architecture REFERENCE may become an overview, and a
change document has no counterpart yet.

## Why it was left

§8 is a later slice (plan 15 is only its start, ADR-0013). Choosing the mapping now would
guess at attachments and approval that do not exist yet.

## Fix

When the §8 slice is planned, decide the mapping, migrate existing rows to the new enum
values in the same migration, and update the web templates and the seed.
