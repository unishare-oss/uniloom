# Docs

Uniloom's own work is tracked here in Markdown, not in a tracker.

| Folder       | What goes in it                                        | File name             |
| ------------ | ------------------------------------------------------ | --------------------- |
| `plans/`     | One plan per slice: scope, done-when checklist, design | `NN-short-name.md`    |
| `adr/`       | Architecture decisions that outlive one slice          | `NNNN-short-title.md` |
| `tech-debt/` | Known shortcuts and problems to fix later              | `NNN-short-title.md`  |

Numbers only go up. Never reuse or delete one: mark it done, superseded or won't fix.

## Plans

Each slice in `MVP.md` §14 gets a plan before code is written. Status is one of
`Aligning`, `Ready`, `In Progress`, `Blocked`, `In Review`, `Done`, `Canceled`.

```markdown
# NN: Slice title

Status: Aligning

## Scope

What this slice delivers, end to end, and what it leaves out.

## Done when

- [ ] 3 to 6 concrete, checkable items taken from the spec

## Design

| Function | File | What | Why |
| -------- | ---- | ---- | --- |

Flows as Mermaid diagrams. Notes and links to ADRs.

## Changes

Filled in at the end: commits, what changed and how, planned vs actual.
```

## ADRs

```markdown
# ADR-NNNN: Title

Status: Proposed | Accepted | Rejected | Superseded by ADR-NNNN
Date: YYYY-MM-DD

## Context

## Options

## Decision

## Consequences
```

## Tech debt

```markdown
# TD-NNN: Title

Status: Open | Fixed | Won't fix
Found: YYYY-MM-DD, in plan NN or commit SHA

## Problem

## Why it was left

## Fix
```
