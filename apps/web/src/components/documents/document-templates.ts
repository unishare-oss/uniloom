import type { DocumentKind } from "@/components/documents/document-meta";

/** Starting text per kind: a suggestion the writer replaces, not a rule. */
export const DOCUMENT_TEMPLATES: Record<DocumentKind, string> = {
  SLO: `## Service / journey

Which user journey or service does this objective cover?

## Indicator (SLI)

Define good events and eligible events, or another measurable indicator.

## Target and window

Target: TBD after a representative baseline. Measurement window: TBD.

## Measurement source

Where are measurements collected? Verify instrumentation exists.

## Owner

Name the accountable service owner (not necessarily this document's author).

## Exclusions

## Response policy

What happens when the objective is missed?

## Related documents

Link relevant specs, proposals and ADRs.
`,
  SLA: `## Audience / customer

## Service commitments

Draft commitments: TBD; no guarantee is implied by this template.

## Measurement terms

## Exclusions

## Remedies

TBD by the agreement's parties.

## Effective dates

TBD.

## Accountable owner

## Agreement state

Draft; no acceptance recorded by Uniloom.

## Supporting SLOs

Link existing project SLO documents using their website URLs. Updating an SLO does not update this agreement.
`,
  BRIEF: `## Problem

What hurts today, and for whom?

## Goal

What is better when this is done?

## Users

## Out of scope
`,
  PROPOSAL: `## Summary

One paragraph: what we propose.

## Motivation

Why now?

## Options

1. Option A
2. Option B

## Recommendation

## Open questions
`,
  SPEC: `## Overview

## Behaviour

- When ..., then ...

## Edge cases

## Acceptance
`,
  REFERENCE: `## Overview

## Details

## Links
`,
  TECH_DEBT: `## What

What is the shortcut or problem?

## Why it matters

What goes wrong if we leave it?

## Suggested fix
`,
  ADR: `## Context

What forces led to this decision?

## Options

1. Option A
2. Option B

## Decision

What we chose, and why.

## Consequences

What gets easier, and what gets harder.
`,
};
