# ADR-0010: Managers create labels

Status: Accepted
Date: 2026-10-07

## Context

ADR-0007 gives "labels" to the Owner alone. Plan 27 builds labels, and the user wants
Managers to create them too: Managers break features into tickets, and a missing label
(`frontend`, `docs`) shouldn't wait for the Owner.

## Options

1. **Owner only**, as ADR-0007 says. Managers ask the Owner for every new label.
2. **Managers do everything with labels.** Managers could also delete labels or move them
   into a group, which changes existing items and, once label overrides exist, a
   project's rules.
3. **Managers create labels and change name and colour; group changes and deletes stay
   with the Owner.**

## Decision

Option 3, the user asked for Managers to create labels; the split on group and delete
keeps rule-shaping changes with the Owner.

| Action                                 | Owner | Manager | Member |
| -------------------------------------- | ----- | ------- | ------ |
| List labels                            | yes   | yes     | yes    |
| Create a label, change name or colour  | yes   | yes     | no     |
| Change a label's group, delete a label | yes   | no      | no     |
| Put labels on items                    | yes   | yes     | yes    |

## Consequences

- ADR-0007's Owner row still lists labels; this ADR narrows it to group changes and
  deletes, and adds label creation to the Manager row.
- `GET /projects/:id` returns `canCreateLabels` so the web never repeats the rule.
- A Manager can rename a label. When label overrides arrive (§14 step 7), they must
  point at label ids, not names, so a rename can't switch a rule on or off.
