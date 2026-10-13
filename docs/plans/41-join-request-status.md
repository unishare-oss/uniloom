# 41: The requester's view of a join request

Status: In Progress

## Scope

After asking to join a project ([plan 40](40-join-approval.md)), a person can see that
they are waiting, cancel, and find out when they were declined. No email is sent
([ADR-0014](../adr/0014-project-invite-links.md)), so the app has to show it.

- **API:** list my waiting requests; cancel one of mine.
- **Web:** a "Waiting for approval" section on the home page, and the full set of states
  on the join page.

Rules (user decisions, 2026-10-13):

- Cancelling does not give the slot back, and asking again through the same link takes no
  new slot.
- A declined request disappears from the home page without a message. The join page says
  it was declined and offers "Ask again" while the link is live.

Left out:

- Notifications, a history of past requests, a reason for a decline.

## Done when

- [x] `GET /join-requests` returns the caller's waiting requests with the project's name
      and key prefix and when they asked. It never returns anything else about a project
      the caller isn't in.
- [x] `DELETE /join-requests/:requestId` cancels the caller's own waiting request (status
      `CANCELED`, slot kept); someone else's request or an unknown id answers `404`; a
      request that is no longer waiting answers `409 already_decided`.
- [x] `GET /invites/:token` returns the caller's request state for that project (`PENDING`,
      `DECLINED`, `CANCELED` or none), also when the link is expired, full or deleted and
      the caller has a waiting request from it.
- [ ] The home page shows "Waiting for approval" under the projects, one row per request
      with a Cancel button, and nothing when there are none.
- [ ] The join page shows: waiting (with "Cancel request"), declined (with "Ask again"
      while the link is live), and sends an approved person to the board.
- [x] Seed: a project you are not in where you have a waiting request, and one where your
      request was declined; the seed prints both links.

## Design

| Function                               | File                                   | What                                                                                                                                                                                     | Why                                                                                      |
| -------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `CANCELED` status, migration           | `prisma/schema.prisma`                 | One more value in the request status enum.                                                                                                                                               | Done-when 2. The row is kept so that asking again reuses it.                             |
| `listMyJoinRequests(userId)`           | `invites/request.service.ts`           | The caller's `PENDING` rows with `{ id, projectName, keyPrefix, createdAt }`.                                                                                                            | Done-when 1. The same three facts the link preview already shows a non-member.           |
| `cancelJoinRequest(userId, requestId)` | `invites/request.service.ts`           | Finds the request by id and user (`404` otherwise), `409 already_decided` unless `PENDING`, sets `CANCELED`. One conditional update, so a cancel racing an approval has one winner.      | Done-when 2.                                                                             |
| `previewInvite` (changed)              | `invites/invite.service.ts`            | Looks up the caller's request for the link's project before checking the link's state. With a waiting request, a dead link still answers with the project name and `request: 'PENDING'`. | Done-when 3. Requests outlive their link, so the person who asked must still see theirs. |
| `askToJoin` (changed)                  | `invites/request.service.ts`           | Treats `CANCELED` like `DECLINED`: back to `PENDING`, no slot.                                                                                                                           | Scope rule.                                                                              |
| `PendingRequests`, `PendingRequestRow` | `web/components/projects/`             | The home page section.                                                                                                                                                                   | Done-when 4.                                                                             |
| `JoinPage` (changed)                   | `web/components/invites/join-page.tsx` | Renders by `isMember` and `request`.                                                                                                                                                     | Done-when 5.                                                                             |
| seed                                   | `api/scripts/seed.ts`                  | `TW` (you are waiting) and `TD` (you were declined).                                                                                                                                     | Done-when 6.                                                                             |

```mermaid
stateDiagram-v2
    [*] --> PENDING: asks through a link (slot used once)
    PENDING --> APPROVED: owner or manager approves, Member row added
    PENDING --> DECLINED: owner or manager declines
    PENDING --> CANCELED: requester cancels
    DECLINED --> PENDING: asks again, same link, no slot
    CANCELED --> PENDING: asks again, same link, no slot
    APPROVED --> PENDING: left the project, asks again, no slot
```

Text:

- Home page: heading "Waiting for approval", row "Unigym (UG), asked 2 hours ago", button
  "Cancel request".
- Join page, waiting: "Your request to join Unigym is waiting for an owner or manager."
- Join page, declined: "Your request to join Unigym was declined." and "Ask again", or
  "This link no longer works, so ask for a new one." when the link is dead.
- Cancel asks first: "Cancel your request to join Unigym? You can ask again while the link
  works."

Accessibility (WCAG 2.2 AA):

- The section is a labelled region; each Cancel button names the project in its
  `aria-label`.
- State changes on the join page are announced with `role="status"` (waiting, sent) or
  `role="alert"` (declined, dead link).
- After cancelling on the home page, focus moves to the next row or to the section heading.

Notes:

- Tests first: the e2e cases are added to `test/join-requests.e2e-spec.ts` and seen
  failing before the service changes.

## Changes
