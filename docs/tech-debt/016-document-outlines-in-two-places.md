# TD-016: Document section outlines live in two places

Status: Open
Found: 2026-10-13, in plan 42

## Problem

The website's starting text per document kind is in
`apps/web/src/components/documents/document-templates.ts`. Plan 42 names the same
sections in the `save_document` tool description so agents write documents of the same
shape. Changing one doesn't change the other.

## Why it was left

The outlines are a suggestion, not a rule, and a one-line copy is simpler than a new
endpoint the web app would have to fetch before showing the New document page.

## Fix

Move the outlines into the API (for example `GET /api/document-templates`) and have both
the web page and the tool description read them from there.
