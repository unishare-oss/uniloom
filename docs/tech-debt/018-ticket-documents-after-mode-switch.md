# TD-018: Ticket documents stay reachable after a project switches to Standard

Status: Open
Found: 2026-10-13, in plan 39's review

## Problem

Ticket documents, links, ADRs and tech debt are Guided only (ADR-0014), and a project's
`mode` can be changed afterwards. After a Guided project switches to Standard,
`GET /api/items/:id` returns `related: []`, but its ticket documents can still be opened,
edited (`PATCH /api/documents/:id` doesn't call `guidedOnlyError`) and listed with
`includeTicketDocuments`. Nothing says whether that is intended.

## Why it was left

Plan 39 only guards creating, linking and unlinking. Mode switching itself is unsettled
(TD-007), so choosing hide, read-only or keep-editable now would guess.

## Fix

Decide with TD-007: either keep them readable and read-only in Standard (check
`guidedOnlyError` in `updateDocumentById` for ticket documents), or hide them like
`related`. Add an e2e case for a switched project.
