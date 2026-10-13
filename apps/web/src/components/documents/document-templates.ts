import type { DocumentKind } from "@/components/documents/document-meta";

/** Starting text per kind: a suggestion the writer replaces, not a rule. */
export const DOCUMENT_TEMPLATES: Record<DocumentKind, string> = {
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
