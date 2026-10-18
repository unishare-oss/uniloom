# Planning a feature

A feature is what the user asked for. It holds one or more slices: a slice is one piece of
the feature that can be reviewed and shipped on its own.

## Writing the feature

- **Title**: what the user gets, in plain words (`Chat rooms`), not how it is built.
- **Description**: the goal in one or two sentences, then bullets for the scope and what
  is left out on purpose. The slices and their SPECs hold the detail.
- The feature has no SPEC of its own; each slice gets one.

## When to split into slices

Start with one slice. Split only when one of these is true:

- **Too many done-when items.** It needs more than 6 items (or the project's
  `checklistMax`). Seven items means two slices. The server refuses more with
  `checklist_max_exceeded`.
- **Too many functions.** The design lists more than about 8 meaningful functions. More
  than that is too big to review.
- **Part of it is usable earlier.** A smaller piece already gives a person something to
  use, and the rest builds on it.
- **Parts wait on different things.** One part needs an ADR accepted, a decision from the
  user or another slice first, and the rest does not.

Don't split when:

- The change is small. A feature with one slice is fine; don't split for the sake of it.
- The split would be by layer (one slice for the schema, one for the API, one for the UI).
- A piece cannot be reviewed or used on its own.

## Slice rules

- **Vertical, not layered.** Each slice goes end to end: data, API, UI and tests for one
  behaviour.
- **3–6 done-when items per slice**, or the project's limits from `list_projects`.
- **Two levels only.** A slice cannot have slices. A slice that grows becomes more slices
  of the same feature. The slice is the unit of review: it carries the SPEC, the
  checklist and the move to Ready and In Review, so a slice that needs pieces is already
  too big.
- **Order by dependency.** Say which slice waits on which. The first slice is the
  smallest thing a person can use. Create slices in that order and set `blockedBy` on the
  ones that wait.

## Done-when items

Each item is one result someone can check, derived from what the user asked for.

| Good                                                             | Bad                    |
| ---------------------------------------------------------------- | ---------------------- |
| `POST /api/rooms/:id/messages` saves the message and returns 201 | Implement messages API |
| A non-member posting to a room gets 404                          | Handle errors          |
| The room page shows new messages without a reload                | Frontend works         |
| `test_post_message_requires_membership` passes                   | Tests written          |

- One behaviour per item.
- Name the route, screen, rule or test it is about.
- No generic items (`code reviewed`, `lint passes`, `docs updated`): checks run on every
  slice anyway.

## Proposing the feature

Show the user, before creating anything:

```text
Feature: Chat rooms

1. Create and join a room            (no blockers)
   - POST /api/rooms creates a room and makes the creator a member
   - ...
2. Send and read messages in a room  (waits on 1)
   - ...
```

Then wait for "yes" or changes. Create only what was confirmed.
