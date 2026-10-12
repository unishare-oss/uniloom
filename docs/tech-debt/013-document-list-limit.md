# TD-013: Library counts cover at most 200 documents

Status: Open
Found: 2026-10-12, in plan 15

## Problem

`GET /api/projects/:projectId/documents` returns at most 200 rows. The Knowledge page
filters by kind and counts each kind tab in the browser over that list, so in a project
with more than 200 documents the counts and tabs are incomplete, and older documents
can only be found by title search.

## Why it was left

Plan 15 caps the list at 200 and has no paging; a project is not expected to reach it
soon.

## Fix

Add paging (cursor) to the list and return per-kind counts from the API, then send the
`kind` filter from the web instead of filtering the loaded rows.
