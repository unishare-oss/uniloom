# ADR-0018: SLO and SLA are project Knowledge document kinds

Status: Proposed
Date: 2026-10-15

## Context

The user wants standalone SLO and SLA document kinds alongside proposals, specs,
ADRs and tech debt. This is a product capability in Uniloom, not reliability
content to add to Unigym. The current document table, editor and MCP tools already
handle typed Markdown; Knowledge documents can link to multiple Guided tickets.

## Options

1. Keep SLO/SLA as ordinary Reference documents with naming conventions.
2. Add `SLO` and `SLA` document kinds using existing Knowledge storage and templates.
3. Add structured reliability and agreement tables with metrics, lifecycle and
   enforcement from the outset.

## Decision

The user chose standalone kinds and two slices: SLO first, SLA afterward. I propose
option 2, extending ADR-0013/0014 with both kinds as project Knowledge in either
project mode. They have no ticket home, per-kind number or workflow status; they
use existing Knowledge create/edit/read/archive permissions. Linking to tickets
keeps existing Guided-only rules and ticket-edit permissions.

Meaningful reliability/agreement fields start as Markdown template sections.
SLA documents reference supporting SLOs through ordinary Markdown links. Neither
kind requires a proposal, nor does an SLA require an SLO to be created. Specs may
reference relevant SLOs without gaining a new workflow gate.

This is my proposed initial lifecycle, not a claim of agreement acceptance:
document creation/editing records authorship only. SLA draft/agreement context is
body text, and Uniloom does not attest acceptance or enforce remedies in these slices.

## Consequences

- SLO/SLA are discoverable and filterable without another editor, table or tool family.
- Owners/Managers maintain shared service documents; members can read them.
- Both coding and other project modes can document service expectations.
- Markdown sections remain flexible but cannot support computed compliance or
  validated numeric targets; content completeness is a human review responsibility.
- Ordinary SLO links have no referential validation, automatic backlinks or change
  propagation. Structured relationships can be proposed when needed.
- Archival keeps existing storage behavior; it is not a contractual termination event.
- Approval, revision snapshots, signatures, telemetry and breach actions need future
  confirmed scopes; none is implied by introducing a document kind.
