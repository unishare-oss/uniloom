# ADR-0007: Manager instead of Reviewer, and only managers create work

Status: Accepted
Date: 2026-10-05

## Context

`MVP.md` §4 has three roles: Owner (everything, plus members and settings), Reviewer
(approve designs, accept ADRs, move items to Done) and Member (read, comment, create and
edit work). Plan 08 built them, with only member management limited to owners.

The user wants a role between Owner and Member that plans the work: it creates tickets and
brings people in, but can't change roles or delete the project. Members should do the work
(move tickets across states, edit them) without creating new tickets.

## Options

1. **Keep the spec roles.** Any member creates tickets. Doesn't give the control asked for.
2. **Add a fourth role, Manager, next to Reviewer.** Plans work and reviews it as separate
   people. More roles to explain, and nobody asked for the split.
3. **Rename Reviewer to Manager and widen it.** The Manager creates and deletes tickets,
   adds members, and keeps every review action from the spec. Members lose create and delete.

## Decision

Option 3, chosen by the user.

| Role        | Can do                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| **Owner**   | Everything: change roles, remove members, key prefix, labels, mode and switches, delete the project              |
| **Manager** | Create and delete tickets and subtasks, add members (as Member only), approve designs, accept ADRs, move to Done |
| **Member**  | Read, comment, move tickets across states and edit them. Works through their own agent                           |

- A Manager can only add people as **Member**, so a Manager can never give anyone more
  power than a Member's.
- Changing roles and removing other people stay Owner-only. Anyone can still leave.
- The `Role` enum value `REVIEWER` is renamed to `MANAGER`; existing rows keep their place.

## Consequences

- A member's agent acts as that member, so over MCP it can move and edit tickets but not
  create them. A Manager or Owner breaks work into tickets; members carry them out.
- "Approver ≠ author" now reads "a different manager". Nothing changes in how it works.
- `MVP.md` §4 and every place that says "reviewer" follow this table.
- The web app gets the create and add-member rules as flags from the API, so it never
  repeats them.
