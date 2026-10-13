# ADR-0015: Project invite links

Status: Proposed
Date: 2026-10-13

## Context

A person can only be added to a project by email, and only after they have signed in to
Uniloom once (`404 user_not_found` otherwise). `MVP.md` §4 says access is by invitation and
§14 row 6 lists invites, but none were built. The user asked for a shareable link per
project, with an expiry, a limit on how many people it lets in, and an option to approve
each person first.

`MVP.md` §2 keeps email and chat notifications out of the MVP, and the API has no mail
code. The in-app notifications of ADR-0011 belong to review events and items, so they do
not fit a join request without a schema change.

## Options

1. Email invites: a pending invite per address, sent by mail. Needs a mail provider and a
   sender domain, and still fails for someone who signs in with another address.
2. One link per project that anyone signed in can use, with expiry, a use limit and
   optional approval. No mail.
3. Several named links per project, each with its own settings and counters, as Discord
   does. More to manage than a small team needs.

For the token: store it hashed (shown once) or as is (can be copied again).

For approval: tell approvers by email, or show the requests in the app.

## Decision

Option 2, decided with the user on 2026-10-13.

- **One live link per project.** The inviter picks the options first (require approval,
  expiry, limit), then creates the link. A live link is never edited: any change makes a
  new link and the old one stops working at once. This removes the case where an approval
  link is switched to open and lets in everyone who already holds it.
- **The link gives the Member role only.** Owners promote afterwards. Owners and Managers
  create and delete links; Managers can already add Members.
- **The link belongs to the project.** It keeps working when its creator is demoted or
  leaves, and any Owner or Manager can delete it.
- **The token is 32 random bytes, stored as is.** The Members page shows the link with a
  Copy button for as long as it is live. Better Auth already stores session tokens unhashed
  in `session.token`, so hashing this one would not protect a leaked database. The token is
  the only secret; nothing else identifies a link from outside.
- **Expiry is 1 hour, 24 hours (default), 7 days or 30 days.** There is no "never".
- **The limit counts people, once each.** An open link uses a slot when a person joins. An
  approval link uses a slot when a person first asks. Declining, cancelling, leaving or
  asking again never gives a slot back and never takes a second one. The limit is what
  keeps the request list short.
- **Joining is a button press (POST), never the page load.** Chat apps fetch pasted links
  to build a preview, and a GET that adds a member could be triggered from another site.
- **Approval is in the app.** Requests show on the Members page to Owners and Managers,
  with a count on the sidebar link. Requests outlive their link and never expire: the link
  only controls who may ask. No email is sent.
- **Web only.** No MCP tools create links or approve requests: who gets into a project is a
  person's decision.
- **Old links stay in the table** with `revokedAt` set, so a request keeps pointing at the
  link it came from and the per-person slot rule has something to check.

## Consequences

- A new person follows one link: sign in on uniAuth, accept the terms, land back on the
  join page (the `next` round trip that login and consent already do), press Join.
- Anyone who reads the database can use live links. Short expiries and limits bound that.
- Changing a link's settings means sending the link again.
- A person an Owner removes can come back through a live open link. The remove dialog
  offers to turn the link off; there is no ban list.
- A declined person can ask again through the same link (without using another slot) until
  the link is replaced. Blocking them would be a later addition.
- An approver only learns of a request by opening Uniloom. Email delivery would be a new
  channel on top of the same request rows (see ADR-0011 on delivery jobs).
- A replaced or deleted link keeps its row for 30 days, then goes with its decided
  requests the next time the project creates a link. A link someone still waits on stays.

Related plans: [43](../plans/43-invite-links.md), [44](../plans/44-join-approval.md),
[45](../plans/45-join-request-status.md).
